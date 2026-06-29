import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/app/auth/AuthProvider';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { MessageSquare, Send, Plus, ChevronLeft, Check, CheckCheck, Search, Clock } from 'lucide-react';
import { enqueue } from '@/offline/syncQueue';
import { useDraft } from '@/offline/drafts';

/**
 * WhatsApp-style 1:1 messaging, backed by /api/messages and synced to the app's
 * user profiles. Who may message whom is enforced server-side (hub-and-spoke
 * around the ops team); this UI just reflects what the API allows.
 */

const ROLE_COLOR = {
  owner: 'bg-purple-100 text-purple-700',
  ops_admin: 'bg-blue-100 text-blue-700',
  contractor: 'bg-amber-100 text-amber-700',
  client: 'bg-green-100 text-green-700',
};
const ROLE_LABEL = {
  owner: 'Owner',
  ops_admin: 'Ops',
  contractor: 'Contractor',
  client: 'Client',
};

function initials(name) {
  return (name || 'U')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

function fmtWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function PersonAvatar({ contact, size = 'h-10 w-10' }) {
  return (
    <Avatar className={size}>
      {contact?.profile_photo_url && <AvatarImage src={contact.profile_photo_url} alt={contact?.name} />}
      <AvatarFallback className="bg-secondary text-secondary-foreground text-xs font-semibold">
        {initials(contact?.name)}
      </AvatarFallback>
    </Avatar>
  );
}

function RoleBadge({ role }) {
  if (!role) return null;
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${ROLE_COLOR[role] ?? 'bg-muted text-muted-foreground'}`}>
      {ROLE_LABEL[role] ?? role}
    </span>
  );
}

export default function Messages() {
  const { principal } = useAuth();
  const myId = principal?.userId;

  const [conversations, setConversations] = useState([]);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [activeId, setActiveId] = useState(null);
  const [activeOther, setActiveOther] = useState(null);
  const [messages, setMessages] = useState([]);
  // Composer text is persisted as a per-conversation draft (survives refresh/crash).
  const [input, setInput, clearInput] = useDraft(activeId ? `msg:${activeId}` : '', '');
  const [sending, setSending] = useState(false);

  const [contactsOpen, setContactsOpen] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactSearch, setContactSearch] = useState('');

  const endRef = useRef(null);
  const lastCountRef = useRef(0);
  const wsRef = useRef(null);
  const typingTimerRef = useRef(null);
  const lastTypingSentRef = useRef(0);
  const [peerTyping, setPeerTyping] = useState(false);
  const [onlineIds, setOnlineIds] = useState(() => new Set());

  const loadConversations = useCallback(async () => {
    try {
      const r = await api.messages.conversations();
      setConversations(r.conversations ?? []);
    } catch {
      /* non-fatal — list just stays as-is */
    } finally {
      setLoadingConvos(false);
    }
  }, []);

  const loadMessages = useCallback(async (convId) => {
    if (!convId) return;
    try {
      const r = await api.messages.listMessages(convId);
      setMessages(r.messages ?? []);
    } catch {
      /* non-fatal */
    }
  }, []);

  // Initial load + poll the conversation list for new activity / unread counts.
  useEffect(() => {
    void loadConversations();
    const t = setInterval(() => void loadConversations(), 5000);
    return () => clearInterval(t);
  }, [loadConversations]);

  // Load the open conversation's messages, then keep a relaxed poll as a safety
  // net behind the realtime socket.
  useEffect(() => {
    if (!activeId) return;
    void loadMessages(activeId);
    const t = setInterval(() => void loadMessages(activeId), 10000);
    return () => clearInterval(t);
  }, [activeId, loadMessages]);

  // Realtime channel (Durable Object) for the open conversation: live messages,
  // typing and presence. Falls back to the poll above if the socket can't open.
  useEffect(() => {
    if (!activeId) return;
    let closed = false;
    let reconnectTimer = null;

    function connect() {
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${window.location.host}/api/messages/conversations/${activeId}/ws`);
      wsRef.current = ws;
      ws.onmessage = (ev) => {
        let data;
        try {
          data = JSON.parse(ev.data);
        } catch {
          return;
        }
        if (data.type === 'message' && data.message?.conversation_id === activeId) {
          const msg = data.message;
          setMessages((prev) =>
            prev.some((m) => m.id === msg.id) ? prev : [...prev, { ...msg, mine: msg.sender_user_id === myId }],
          );
          void loadConversations();
        } else if (data.type === 'typing' && data.userId && data.userId !== myId) {
          setPeerTyping(true);
          clearTimeout(typingTimerRef.current);
          typingTimerRef.current = setTimeout(() => setPeerTyping(false), 3000);
        } else if (data.type === 'presence') {
          setOnlineIds(new Set(data.online ?? []));
        }
      };
      ws.onclose = () => {
        wsRef.current = null;
        if (!closed) reconnectTimer = setTimeout(connect, 2500);
      };
      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      };
    }
    connect();

    return () => {
      closed = true;
      clearTimeout(reconnectTimer);
      clearTimeout(typingTimerRef.current);
      setPeerTyping(false);
      setOnlineIds(new Set());
      try {
        wsRef.current?.close();
      } catch {
        /* ignore */
      }
      wsRef.current = null;
    };
  }, [activeId, myId, loadConversations]);

  function notifyTyping() {
    const now = Date.now();
    if (now - lastTypingSentRef.current > 1500 && wsRef.current?.readyState === WebSocket.OPEN) {
      lastTypingSentRef.current = now;
      wsRef.current.send(JSON.stringify({ type: 'typing' }));
    }
  }

  // Auto-scroll to the newest message when the count grows.
  useEffect(() => {
    if (messages.length !== lastCountRef.current) {
      lastCountRef.current = messages.length;
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 40);
    }
  }, [messages]);

  function openConversation(convo) {
    setActiveId(convo.id);
    setActiveOther(convo.other);
    setMessages([]);
    lastCountRef.current = 0;
  }

  async function openContacts() {
    setContactsOpen(true);
    setLoadingContacts(true);
    try {
      const r = await api.messages.contacts();
      setContacts(r.contacts ?? []);
    } catch {
      setContacts([]);
    } finally {
      setLoadingContacts(false);
    }
  }

  async function startWith(contact) {
    try {
      const r = await api.messages.startConversation(contact.user_id);
      setContactsOpen(false);
      setContactSearch('');
      openConversation({ id: r.conversation.id, other: r.conversation.other });
      void loadConversations();
    } catch {
      /* ignore — most likely a permission/network error */
    }
  }

  async function sendMessage(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || !activeId || sending) return;
    setSending(true);
    clearInput();
    const convId = activeId;
    // Optimistic append.
    const optimistic = {
      id: `tmp-${Date.now()}`,
      sender_user_id: myId,
      body: text,
      read_at: null,
      created_at: new Date().toISOString(),
      mine: true,
      pending: true,
    };
    setMessages((m) => [...m, optimistic]);
    try {
      if (!navigator.onLine) throw new Error('offline');
      await api.messages.send(convId, text);
      await loadMessages(convId);
      void loadConversations();
    } catch {
      // Offline or send failed → queue for delivery when back online; keep the
      // bubble visible, marked as queued.
      await enqueue('sendMessage', { conversationId: convId, body: text });
      setMessages((m) => m.map((x) => (x.id === optimistic.id ? { ...x, queued: true, pending: false } : x)));
    } finally {
      setSending(false);
    }
  }

  const filteredContacts = contacts.filter((c) =>
    c.name.toLowerCase().includes(contactSearch.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <MessageSquare size={22} className="text-primary" /> Messages
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Chat directly with your team.</p>
        </div>
        <Dialog open={contactsOpen} onOpenChange={(o) => (o ? openContacts() : setContactsOpen(false))}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus size={16} /> New chat
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Start a conversation</DialogTitle>
            </DialogHeader>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                placeholder="Search people…"
                className="pl-9"
              />
            </div>
            <div className="max-h-80 overflow-y-auto -mx-2">
              {loadingContacts && <p className="px-4 py-6 text-sm text-muted-foreground text-center">Loading…</p>}
              {!loadingContacts && filteredContacts.length === 0 && (
                <p className="px-4 py-6 text-sm text-muted-foreground text-center">No one to message.</p>
              )}
              {filteredContacts.map((c) => (
                <button
                  key={c.user_id}
                  onClick={() => startWith(c)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-muted"
                >
                  <PersonAvatar contact={c} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate font-medium text-sm">{c.name}</span>
                      <RoleBadge role={c.role} />
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4 h-[calc(100vh-220px)] min-h-[520px]">
        {/* Conversation list */}
        <div className={`w-72 flex-shrink-0 flex-col gap-1 ${activeId ? 'hidden sm:flex' : 'flex w-full sm:w-72'}`}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-1">Chats</p>

          {loadingConvos && <p className="text-sm text-muted-foreground px-1">Loading…</p>}

          {!loadingConvos && conversations.length === 0 && (
            <div className="rounded-lg border border-dashed p-5 text-center">
              <p className="text-xs text-muted-foreground">No conversations yet.</p>
              <Button variant="link" size="sm" className="mt-1" onClick={openContacts}>
                Start one
              </Button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto space-y-0.5">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => openConversation(conv)}
                className={`flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors ${
                  conv.id === activeId ? 'bg-primary/10' : 'hover:bg-muted'
                }`}
              >
                <PersonAvatar contact={conv.other} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate font-medium text-sm">{conv.other?.name}</span>
                    <RoleBadge role={conv.other?.role} />
                    <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                      {fmtWhen(conv.last_message_at)}
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-xs text-muted-foreground">
                      {conv.last_message_preview || 'No messages yet'}
                    </span>
                    {conv.unread > 0 && (
                      <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground shrink-0">
                        {conv.unread}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Chat panel */}
        {activeId ? (
          <div className="flex-1 flex flex-col overflow-hidden rounded-xl border bg-card">
            {/* Header */}
            <div className="flex items-center gap-3 border-b px-3 py-2.5">
              <button className="sm:hidden text-muted-foreground" onClick={() => setActiveId(null)} aria-label="Back">
                <ChevronLeft size={20} />
              </button>
              <div className="relative">
                <PersonAvatar contact={activeOther} size="h-9 w-9" />
                {activeOther?.user_id && onlineIds.has(activeOther.user_id) && (
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-card" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-semibold text-sm truncate">{activeOther?.name}</p>
                  <RoleBadge role={activeOther?.role} />
                </div>
                <p className="h-4 text-xs text-primary">
                  {peerTyping
                    ? 'typing…'
                    : activeOther?.user_id && onlineIds.has(activeOther.user_id)
                      ? 'Online'
                      : ''}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-2 bg-muted/30">
              {messages.length === 0 && (
                <div className="text-center py-12">
                  <MessageSquare size={28} className="mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No messages yet. Say hello 👋</p>
                </div>
              )}

              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[78%] rounded-2xl px-3.5 py-2 ${
                      m.mine
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-card border text-foreground rounded-bl-sm'
                    }`}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{m.body}</p>
                    <span
                      className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${
                        m.mine ? 'text-primary-foreground/80' : 'text-muted-foreground'
                      }`}
                    >
                      {fmtWhen(m.created_at)}
                      {m.mine &&
                        (m.queued ? (
                          <Clock size={12} />
                        ) : m.read_at ? (
                          <CheckCheck size={13} />
                        ) : (
                          <Check size={13} className={m.pending ? 'opacity-50' : ''} />
                        ))}
                    </span>
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>

            {/* Composer */}
            <form onSubmit={sendMessage} className="flex gap-2 border-t p-3">
              <Input
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  notifyTyping();
                }}
                placeholder="Type a message…"
                className="flex-1"
              />
              <Button type="submit" size="icon" disabled={!input.trim() || sending} aria-label="Send">
                <Send size={16} />
              </Button>
            </form>
          </div>
        ) : (
          <div className="hidden sm:flex flex-1 items-center justify-center border rounded-xl border-dashed">
            <div className="text-center">
              <MessageSquare size={36} className="mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Select a chat or start a new one</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
