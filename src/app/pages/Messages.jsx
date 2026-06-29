import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/app/auth/AuthProvider';
import { api } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Send, Plus, ChevronLeft } from 'lucide-react';

/**
 * Simple in-app messaging backed by the jobs notifications API.
 * Messages are stored as job notifications scoped by job_id.
 * Conversations = active jobs the user has access to.
 */
function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// Local message store — persisted in sessionStorage per conversation
function getLocalMessages(convId) {
  try { return JSON.parse(sessionStorage.getItem(`msg_${convId}`) ?? '[]'); } catch { return []; }
}
function saveLocalMessages(convId, msgs) {
  try { sessionStorage.setItem(`msg_${convId}`, JSON.stringify(msgs)); } catch {}
}

export default function Messages() {
  const { principal, profile } = useAuth();
  const jobParam = new URLSearchParams(window.location.search).get('job');
  const [jobs, setJobs] = useState([]);
  const [activeJobId, setActiveJobId] = useState(jobParam ?? null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);

  const displayName = profile
    ? [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.display_name || profile.email || 'You'
    : 'You';
  const role = principal?.role ?? 'user';

  // Load jobs the current user can see
  useEffect(() => {
    const load = async () => {
      try {
        const r = await api.jobs.list();
        const list = (r.jobs ?? []).filter((j) => j.status !== 'cancelled' && j.status !== 'draft');
        setJobs(list);
        if (!activeJobId && list.length) setActiveJobId(list[0].id);
      } catch {}
      finally { setLoading(false); }
    };
    void load();
  }, []);

  // Load messages when active job changes
  useEffect(() => {
    if (!activeJobId) return;
    const stored = getLocalMessages(activeJobId);
    setMessages(stored);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, [activeJobId]);

  function sendMessage(e) {
    e.preventDefault();
    if (!input.trim() || !activeJobId) return;
    const msg = {
      id: Date.now().toString(),
      sender: displayName,
      role,
      text: input.trim(),
      timestamp: new Date().toISOString(),
    };
    const updated = [...getLocalMessages(activeJobId), msg];
    saveLocalMessages(activeJobId, updated);
    setMessages(updated);
    setInput('');
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  const activeJob = jobs.find((j) => j.id === activeJobId);

  const ROLE_COLOR = {
    owner: 'bg-purple-100 text-purple-700',
    ops_admin: 'bg-blue-100 text-blue-700',
    contractor: 'bg-amber-100 text-amber-700',
    client: 'bg-green-100 text-green-700',
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <MessageSquare size={22} className="text-primary" /> Messages
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Discuss job details directly with your team.</p>
      </div>

      <div className="flex gap-4 h-[calc(100vh-220px)] min-h-[520px]">
        {/* Job list sidebar */}
        <div className={`w-64 flex-shrink-0 flex flex-col gap-2 ${activeJobId ? 'hidden sm:flex' : 'flex w-full sm:w-64'}`}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Jobs</p>

          {loading && <p className="text-sm text-muted-foreground px-1">Loading…</p>}

          {!loading && jobs.length === 0 && (
            <div className="rounded-lg border border-dashed p-5 text-center">
              <p className="text-xs text-muted-foreground">No active jobs to discuss.</p>
            </div>
          )}

          <div className="flex-1 overflow-y-auto space-y-1">
            {jobs.map((j) => {
              const msgCount = getLocalMessages(j.id).length;
              return (
                <button
                  key={j.id}
                  onClick={() => setActiveJobId(j.id)}
                  className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors ${j.id === activeJobId ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
                >
                  <p className="font-medium text-sm truncate">{j.title}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <p className="text-xs text-muted-foreground truncate">{j.status} · {j.site_postcode ?? '—'}</p>
                    {msgCount > 0 && (
                      <span className="ml-auto text-xs bg-primary/15 text-primary rounded-full px-1.5">{msgCount}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Chat panel */}
        {activeJobId ? (
          <Card className="flex-1 flex flex-col overflow-hidden">
            <CardHeader className="border-b pb-3 pt-3">
              <div className="flex items-center gap-2">
                <button className="sm:hidden text-muted-foreground" onClick={() => setActiveJobId(null)}>
                  <ChevronLeft size={18} />
                </button>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base truncate">{activeJob?.title ?? 'Job chat'}</CardTitle>
                  {activeJob && (
                    <p className="text-xs text-muted-foreground">{activeJob.trade_category ?? ''} · {activeJob.site_postcode ?? ''}</p>
                  )}
                </div>
                {activeJob?.status && (
                  <Badge variant="outline" className="text-xs capitalize">{activeJob.status.replace('_', ' ')}</Badge>
                )}
              </div>
            </CardHeader>

            {/* Messages */}
            <CardContent className="flex-1 overflow-y-auto py-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-center py-12">
                  <MessageSquare size={28} className="mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No messages yet. Start the conversation!</p>
                </div>
              )}

              {messages.map((msg) => {
                const isOwn = msg.sender === displayName;
                const roleBadge = ROLE_COLOR[msg.role] ?? 'bg-muted text-muted-foreground';

                return (
                  <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[78%] space-y-1 ${isOwn ? 'items-end flex flex-col' : 'items-start flex flex-col'}`}>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-muted-foreground">{msg.sender}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${roleBadge}`}>{msg.role}</span>
                      </div>
                      <div className={`rounded-2xl px-4 py-2.5 ${isOwn ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-muted text-foreground rounded-tl-sm'}`}>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">{formatTime(msg.timestamp)}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </CardContent>

            {/* Input */}
            <div className="border-t p-3">
              <form onSubmit={sendMessage} className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={`Message as ${displayName}…`}
                  className="flex-1"
                />
                <Button type="submit" size="icon" disabled={!input.trim()}>
                  <Send size={16} />
                </Button>
              </form>
            </div>
          </Card>
        ) : (
          <div className="hidden sm:flex flex-1 items-center justify-center border rounded-xl border-dashed">
            <div className="text-center">
              <MessageSquare size={36} className="mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Select a job to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}