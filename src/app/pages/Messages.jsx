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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { MessageSquare, Send, Plus, ChevronLeft, Check, CheckCheck, Search, Clock, Paperclip, Mic, Square, FileText, Smile, Reply, X, Pin, PinOff, Bell, BellOff, MoreVertical, Users, Briefcase } from 'lucide-react';
import { enqueue } from '@/offline/syncQueue';
import { useDraft } from '@/offline/drafts';
import { REACTION_EMOJI } from '@/domain/messaging/reactions';

// A small, dependency-free emoji palette for inserting into the composer.
const COMPOSER_EMOJI = [
  '😀', '😂', '😍', '😎', '😅', '🙂', '😉', '😢',
  '👍', '👎', '🙏', '👏', '💪', '🔥', '✅', '❌',
  '❤️', '🎉', '👋', '🚀', '⏰', '📍', '📷', '📎',
];

/** Pinned conversations first, then by most recent activity. Stable + pure. */
function sortConvos(list) {
  return [...list].sort((a, b) => {
    if (Number(b.pinned) !== Number(a.pinned)) return Number(b.pinned) - Number(a.pinned);
    return (b.last_message_at || '').localeCompare(a.last_message_at || '');
  });
}

/** Apply a realtime reaction delta to one message's reaction summary. */
function applyReactionDelta(reactions, emoji, add, mine) {
  const list = reactions ? [...reactions] : [];
  const i = list.findIndex((r) => r.emoji === emoji);
  if (add) {
    if (i === -1) list.push({ emoji, count: 1, mine });
    else list[i] = { ...list[i], count: list[i].count + 1, mine: mine || list[i].mine };
  } else if (i !== -1) {
    const count = list[i].count - 1;
    if (count <= 0) list.splice(i, 1);
    else list[i] = { ...list[i], count, mine: mine ? false : list[i].mine };
  }
  return list;
}

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

function GroupAvatar({ size = 'h-10 w-10' }) {
  return (
    <span className={`flex ${size} items-center justify-center rounded-full bg-primary/15 text-primary`}>
      <Briefcase size={16} />
    </span>
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
  const [activeKind, setActiveKind] = useState('direct');
  const [activeTitle, setActiveTitle] = useState(null);
  const [messages, setMessages] = useState([]);
  // Composer text is persisted as a per-conversation draft (survives refresh/crash).
  const [input, setInput, clearInput] = useDraft(activeId ? `msg:${activeId}` : '', '');
  const [sending, setSending] = useState(false);
  // The message currently being replied to (quote), or null.
  const [replyingTo, setReplyingTo] = useState(null);

  const [contactsOpen, setContactsOpen] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  // "New chat" dialog tab: 1:1 people, or job team rooms.
  const [newChatTab, setNewChatTab] = useState('people');
  const [jobChats, setJobChats] = useState([]);
  const [loadingJobChats, setLoadingJobChats] = useState(false);
  // Search across the conversation list, and within the open chat.
  const [convoSearch, setConvoSearch] = useState('');
  const [chatSearch, setChatSearch] = useState('');
  const [chatSearchOpen, setChatSearchOpen] = useState(false);

  const endRef = useRef(null);
  const lastCountRef = useRef(0);
  const fileRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [recording, setRecording] = useState(false);

  async function sendAttachment(file) {
    if (!file || !activeId) return;
    const replyToId = replyingTo?.id;
    setReplyingTo(null);
    try {
      await api.messages.sendAttachment(activeId, file, undefined, replyToId);
      await loadMessages(activeId);
      void loadConversations();
    } catch {
      /* surfaced to the user via the empty state staying; keep it simple */
    }
  }

  // Toggle one of my reactions on a message. Optimistic via the REST response;
  // the realtime delta for my own user id is ignored to avoid double-counting.
  async function toggleReaction(message, emoji) {
    if (!activeId || String(message.id).startsWith('tmp-')) return;
    try {
      const r = await api.messages.react(activeId, message.id, emoji);
      setMessages((prev) =>
        prev.map((m) => (m.id === r.messageId ? { ...m, reactions: r.reactions } : m)),
      );
    } catch {
      /* non-fatal — a poll/socket update will reconcile */
    }
  }

  function insertEmoji(emoji) {
    setInput((v) => (v ?? '') + emoji);
  }

  // Toggle a private pin/mute preference for a conversation (optimistic).
  async function setPref(conv, patch) {
    setConversations((prev) => sortConvos(prev.map((c) => (c.id === conv.id ? { ...c, ...patch } : c))));
    try {
      await api.messages.setPrefs(conv.id, patch);
    } catch {
      void loadConversations();
    }
  }

  async function toggleRecord() {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        const type = mr.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        await sendAttachment(new File([blob], `voice-note.${type.includes('ogg') ? 'ogg' : 'webm'}`, { type }));
      };
      recorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      setRecording(false);
    }
  }
  const wsRef = useRef(null);
  const activeKindRef = useRef('direct');
  useEffect(() => {
    activeKindRef.current = activeKind;
  }, [activeKind]);
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
          // Job rooms are multi-party, so an incoming message needs its sender's
          // name/photo — refetch rather than render an unattributed bubble.
          if (activeKindRef.current === 'job' && msg.sender_user_id !== myId) {
            void loadMessages(activeId);
          } else {
            setMessages((prev) =>
              prev.some((m) => m.id === msg.id) ? prev : [...prev, { ...msg, mine: msg.sender_user_id === myId }],
            );
          }
          void loadConversations();
        } else if (data.type === 'reaction' && data.userId !== myId) {
          // Another participant reacted — apply the delta (my own are applied
          // optimistically from the REST response, so skip userId === myId).
          setMessages((prev) =>
            prev.map((m) =>
              m.id === data.messageId
                ? { ...m, reactions: applyReactionDelta(m.reactions, data.emoji, data.action === 'add', false) }
                : m,
            ),
          );
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
    setActiveOther(convo.other ?? null);
    setActiveKind(convo.kind ?? 'direct');
    setActiveTitle(convo.title ?? null);
    setMessages([]);
    setReplyingTo(null);
    setChatSearch('');
    setChatSearchOpen(false);
    lastCountRef.current = 0;
  }

  async function openContacts() {
    setContactsOpen(true);
    setLoadingContacts(true);
    setLoadingJobChats(true);
    try {
      const r = await api.messages.contacts();
      setContacts(r.contacts ?? []);
    } catch {
      setContacts([]);
    } finally {
      setLoadingContacts(false);
    }
    try {
      const r = await api.messages.jobCandidates();
      setJobChats(r.jobs ?? []);
    } catch {
      setJobChats([]);
    } finally {
      setLoadingJobChats(false);
    }
  }

  async function startWith(contact) {
    try {
      const r = await api.messages.startConversation(contact.user_id);
      setContactsOpen(false);
      setContactSearch('');
      openConversation({ id: r.conversation.id, kind: 'direct', other: r.conversation.other });
      void loadConversations();
    } catch {
      /* ignore — most likely a permission/network error */
    }
  }

  async function startJobChat(candidate) {
    try {
      const r = await api.messages.openJobConversation(candidate.job_id);
      setContactsOpen(false);
      setContactSearch('');
      openConversation({ id: r.conversation.id, kind: 'job', title: r.conversation.title, other: null });
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
    const replyTo = replyingTo;
    setReplyingTo(null);
    // Optimistic append.
    const optimistic = {
      id: `tmp-${Date.now()}`,
      sender_user_id: myId,
      body: text,
      read_at: null,
      created_at: new Date().toISOString(),
      mine: true,
      pending: true,
      reply_to: replyTo
        ? { id: replyTo.id, sender_user_id: replyTo.sender_user_id, body: replyTo.body, attachment_type: replyTo.attachment_type ?? null }
        : null,
    };
    setMessages((m) => [...m, optimistic]);
    try {
      if (!navigator.onLine) throw new Error('offline');
      await api.messages.send(convId, text, replyTo?.id);
      await loadMessages(convId);
      void loadConversations();
    } catch {
      // Offline or send failed → queue for delivery when back online; keep the
      // bubble visible, marked as queued.
      await enqueue('sendMessage', { conversationId: convId, body: text, replyToId: replyTo?.id });
      setMessages((m) => m.map((x) => (x.id === optimistic.id ? { ...x, queued: true, pending: false } : x)));
    } finally {
      setSending(false);
    }
  }

  const filteredContacts = contacts.filter((c) =>
    c.name.toLowerCase().includes(contactSearch.toLowerCase()),
  );

  const convoQuery = convoSearch.trim().toLowerCase();
  const visibleConvos = sortConvos(
    convoQuery
      ? conversations.filter(
          (c) =>
            (c.other?.name || c.title || '').toLowerCase().includes(convoQuery) ||
            (c.last_message_preview || '').toLowerCase().includes(convoQuery),
        )
      : conversations,
  );

  const chatQuery = chatSearch.trim().toLowerCase();
  const visibleMessages = chatQuery
    ? messages.filter((m) => (m.body || '').toLowerCase().includes(chatQuery))
    : messages;

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

            {/* People vs job-team-room tabs */}
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              <button
                type="button"
                onClick={() => setNewChatTab('people')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium transition-colors ${
                  newChatTab === 'people' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <MessageSquare size={14} /> People
              </button>
              <button
                type="button"
                onClick={() => setNewChatTab('jobs')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium transition-colors ${
                  newChatTab === 'jobs' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Briefcase size={14} /> Job chats
              </button>
            </div>

            {newChatTab === 'people' ? (
              <>
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
              </>
            ) : (
              <div className="max-h-80 overflow-y-auto -mx-2">
                {loadingJobChats && <p className="px-4 py-6 text-sm text-muted-foreground text-center">Loading…</p>}
                {!loadingJobChats && jobChats.length === 0 && (
                  <p className="px-4 py-6 text-sm text-muted-foreground text-center">
                    No job team chats available. A job needs an assigned contractor first.
                  </p>
                )}
                {jobChats.map((j) => (
                  <button
                    key={j.job_id}
                    onClick={() => startJobChat(j)}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-muted"
                  >
                    <GroupAvatar />
                    <span className="min-w-0 flex-1">
                      <span className="truncate block font-medium text-sm">{j.title}</span>
                      <span className="truncate block text-xs text-muted-foreground">
                        {j.conversation_id ? 'Open team chat' : 'Start team chat'}
                      </span>
                    </span>
                    <Users size={15} className="shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4 h-[calc(100vh-220px)] min-h-[520px]">
        {/* Conversation list */}
        <div className={`w-72 flex-shrink-0 flex-col gap-1 ${activeId ? 'hidden sm:flex' : 'flex w-full sm:w-72'}`}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-1">Chats</p>

          {/* Search the conversation list */}
          {conversations.length > 0 && (
            <div className="relative mb-1 px-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={convoSearch}
                onChange={(e) => setConvoSearch(e.target.value)}
                placeholder="Search chats…"
                className="h-8 pl-8 text-sm"
              />
            </div>
          )}

          {loadingConvos && <p className="text-sm text-muted-foreground px-1">Loading…</p>}

          {!loadingConvos && conversations.length === 0 && (
            <div className="rounded-lg border border-dashed p-5 text-center">
              <p className="text-xs text-muted-foreground">No conversations yet.</p>
              <Button variant="link" size="sm" className="mt-1" onClick={openContacts}>
                Start one
              </Button>
            </div>
          )}

          {!loadingConvos && conversations.length > 0 && visibleConvos.length === 0 && (
            <p className="px-2 py-3 text-xs text-muted-foreground">No chats match “{convoSearch}”.</p>
          )}

          <div className="flex-1 overflow-y-auto space-y-0.5">
            {visibleConvos.map((conv) => (
              <div
                key={conv.id}
                className={`group relative flex items-center rounded-lg transition-colors ${
                  conv.id === activeId ? 'bg-primary/10' : 'hover:bg-muted'
                }`}
              >
                <button
                  onClick={() => openConversation(conv)}
                  className="flex min-w-0 flex-1 items-center gap-3 px-2 py-2.5 text-left"
                >
                  {conv.kind === 'job' ? <GroupAvatar /> : <PersonAvatar contact={conv.other} />}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      {conv.pinned && <Pin size={11} className="shrink-0 text-primary" />}
                      <span className="truncate font-medium text-sm">
                        {conv.kind === 'job' ? conv.title : conv.other?.name}
                      </span>
                      {conv.kind === 'job' ? (
                        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          Team
                        </span>
                      ) : (
                        <RoleBadge role={conv.other?.role} />
                      )}
                      <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                        {conv.muted && <BellOff size={11} />}
                        {fmtWhen(conv.last_message_at)}
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-xs text-muted-foreground">
                        {conv.last_message_preview || 'No messages yet'}
                      </span>
                      {conv.unread > 0 && (
                        <span
                          className={`ml-auto flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold shrink-0 ${
                            conv.muted
                              ? 'bg-muted-foreground/30 text-muted-foreground'
                              : 'bg-primary text-primary-foreground'
                          }`}
                        >
                          {conv.unread}
                        </span>
                      )}
                    </span>
                  </span>
                </button>

                {/* Per-conversation actions: pin / mute */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="mr-1 rounded-full p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-background group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100"
                      aria-label="Conversation options"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical size={16} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setPref(conv, { pinned: !conv.pinned })}>
                      {conv.pinned ? <PinOff size={14} className="mr-2" /> : <Pin size={14} className="mr-2" />}
                      {conv.pinned ? 'Unpin chat' : 'Pin chat'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setPref(conv, { muted: !conv.muted })}>
                      {conv.muted ? <Bell size={14} className="mr-2" /> : <BellOff size={14} className="mr-2" />}
                      {conv.muted ? 'Unmute' : 'Mute'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
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
                {activeKind === 'job' ? (
                  <GroupAvatar size="h-9 w-9" />
                ) : (
                  <>
                    <PersonAvatar contact={activeOther} size="h-9 w-9" />
                    {activeOther?.user_id && onlineIds.has(activeOther.user_id) && (
                      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-card" />
                    )}
                  </>
                )}
              </div>
              <div className="min-w-0">
                {activeKind === 'job' ? (
                  <>
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-sm truncate">{activeTitle}</p>
                      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        Team
                      </span>
                    </div>
                    <p className="h-4 text-xs text-muted-foreground">
                      {peerTyping ? 'someone is typing…' : 'Ops team + assigned contractors'}
                    </p>
                  </>
                ) : (
                  <>
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
                  </>
                )}
              </div>
              <button
                className="ml-auto rounded-full p-1.5 text-muted-foreground hover:bg-muted"
                onClick={() => {
                  setChatSearchOpen((o) => !o);
                  setChatSearch('');
                }}
                aria-label="Search in conversation"
              >
                {chatSearchOpen ? <X size={18} /> : <Search size={18} />}
              </button>
            </div>

            {/* In-conversation message search */}
            {chatSearchOpen && (
              <div className="relative border-b px-3 py-2">
                <Search size={14} className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  value={chatSearch}
                  onChange={(e) => setChatSearch(e.target.value)}
                  placeholder="Search messages…"
                  className="h-8 pl-7 text-sm"
                />
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-2 bg-muted/30">
              {messages.length === 0 && (
                <div className="text-center py-12">
                  <MessageSquare size={28} className="mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No messages yet. Say hello 👋</p>
                </div>
              )}

              {messages.length > 0 && chatQuery && visibleMessages.length === 0 && (
                <div className="text-center py-12">
                  <Search size={24} className="mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No messages match “{chatSearch}”.</p>
                </div>
              )}

              {visibleMessages.map((m) => {
                const isTmp = String(m.id).startsWith('tmp-');
                return (
                <div key={m.id} className={`group flex flex-col ${m.mine ? 'items-end' : 'items-start'}`}>
                  <div className={`flex items-center gap-1 max-w-[85%] ${m.mine ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div
                    className={`rounded-2xl px-3.5 py-2 ${
                      m.mine
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-card border text-foreground rounded-bl-sm'
                    }`}
                  >
                    {activeKind === 'job' && !m.mine && m.sender && (
                      <p className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold text-primary">
                        {m.sender.name}
                        {m.sender.role && <RoleBadge role={m.sender.role} />}
                      </p>
                    )}
                    {m.reply_to && (
                      <div
                        className={`mb-1 rounded-md border-l-2 px-2 py-1 text-xs ${
                          m.mine
                            ? 'border-primary-foreground/50 bg-primary-foreground/10'
                            : 'border-primary/50 bg-muted'
                        }`}
                      >
                        <span className="block font-medium opacity-80">
                          {m.reply_to.sender_user_id === myId ? 'You' : activeOther?.name || 'Reply'}
                        </span>
                        <span className="block truncate opacity-70">
                          {m.reply_to.body ||
                            (m.reply_to.attachment_type === 'image'
                              ? '📷 Photo'
                              : m.reply_to.attachment_type === 'audio'
                                ? '🎤 Voice note'
                                : '📎 File')}
                        </span>
                      </div>
                    )}
                    {m.attachment_url && m.attachment_type === 'image' && (
                      <a href={m.attachment_url} target="_blank" rel="noreferrer">
                        <img
                          src={m.attachment_url}
                          alt={m.attachment_name ?? 'image'}
                          className="mb-1 max-h-60 rounded-lg object-cover"
                        />
                      </a>
                    )}
                    {m.attachment_url && m.attachment_type === 'audio' && (
                      <audio controls src={m.attachment_url} className="mb-1 w-56 max-w-full" />
                    )}
                    {m.attachment_url && m.attachment_type === 'file' && (
                      <a
                        href={m.attachment_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mb-1 flex items-center gap-1.5 text-sm underline"
                      >
                        <FileText size={14} /> {m.attachment_name ?? 'File'}
                      </a>
                    )}
                    {m.body && (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{m.body}</p>
                    )}
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

                  {/* Hover actions: react + reply (hidden for optimistic/unsent) */}
                  {!isTmp && (
                    <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label="React to message"
                          >
                            <Smile size={15} />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-1" align={m.mine ? 'end' : 'start'}>
                          <div className="flex gap-0.5">
                            {REACTION_EMOJI.map((emoji) => {
                              const active = m.reactions?.some((r) => r.emoji === emoji && r.mine);
                              return (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => toggleReaction(m, emoji)}
                                  className={`rounded-full p-1 text-lg leading-none transition-transform hover:scale-125 ${active ? 'bg-primary/15' : ''}`}
                                  aria-label={`React ${emoji}`}
                                >
                                  {emoji}
                                </button>
                              );
                            })}
                          </div>
                        </PopoverContent>
                      </Popover>
                      <button
                        type="button"
                        onClick={() => setReplyingTo(m)}
                        className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label="Reply to message"
                      >
                        <Reply size={15} />
                      </button>
                    </div>
                  )}
                  </div>

                  {/* Reaction chips */}
                  {m.reactions?.length > 0 && (
                    <div className={`mt-1 flex flex-wrap gap-1 ${m.mine ? 'justify-end pr-1' : 'pl-1'}`}>
                      {m.reactions.map((r) => (
                        <button
                          key={r.emoji}
                          type="button"
                          onClick={() => toggleReaction(m, r.emoji)}
                          className={`flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-xs leading-none transition-colors ${
                            r.mine
                              ? 'border-primary/40 bg-primary/10 text-foreground'
                              : 'border-border bg-muted text-muted-foreground hover:bg-muted/70'
                          }`}
                          aria-label={`${r.emoji} ${r.count}${r.mine ? ' (you reacted)' : ''}`}
                        >
                          <span className="text-sm leading-none">{r.emoji}</span>
                          {r.count > 1 && <span>{r.count}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                );
              })}
              <div ref={endRef} />
            </div>

            {/* Composer */}
            <div className="border-t">
              {/* Reply context bar */}
              {replyingTo && (
                <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
                  <Reply size={15} className="shrink-0 text-primary" />
                  <div className="min-w-0 flex-1 border-l-2 border-primary/50 pl-2">
                    <p className="text-xs font-medium">
                      Replying to {replyingTo.sender_user_id === myId ? 'yourself' : activeOther?.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {replyingTo.body ||
                        (replyingTo.attachment_type === 'image'
                          ? '📷 Photo'
                          : replyingTo.attachment_type === 'audio'
                            ? '🎤 Voice note'
                            : '📎 File')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyingTo(null)}
                    className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted"
                    aria-label="Cancel reply"
                  >
                    <X size={15} />
                  </button>
                </div>
              )}
              <form onSubmit={sendMessage} className="flex items-center gap-1.5 p-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,application/pdf,audio/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) void sendAttachment(f);
                  }}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => fileRef.current?.click()}
                  aria-label="Attach file"
                >
                  <Paperclip size={18} />
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" size="icon" variant="ghost" aria-label="Insert emoji" disabled={recording}>
                      <Smile size={18} />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2" align="start">
                    <div className="grid grid-cols-8 gap-0.5">
                      {COMPOSER_EMOJI.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => insertEmoji(emoji)}
                          className="rounded p-1 text-lg leading-none hover:bg-muted"
                          aria-label={`Insert ${emoji}`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                <Button
                  type="button"
                  size="icon"
                  variant={recording ? 'destructive' : 'ghost'}
                  onClick={toggleRecord}
                  aria-label={recording ? 'Stop recording' : 'Record voice note'}
                >
                  {recording ? <Square size={16} /> : <Mic size={18} />}
                </Button>
                <Input
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    notifyTyping();
                  }}
                  placeholder={recording ? 'Recording…' : 'Type a message…'}
                  className="flex-1"
                  disabled={recording}
                />
                <Button type="submit" size="icon" disabled={!input.trim() || sending} aria-label="Send">
                  <Send size={16} />
                </Button>
              </form>
            </div>
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
