import { useEffect, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Send, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PageHeader from '@/components/shared/PageHeader';
import PullToRefresh from '@/components/shared/PullToRefresh';

export default function Messages() {
  const [threads, setThreads] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [sending, setSending] = useState(false);

  const fetchThreads = useCallback(async () => {
    const me = await base44.auth.me();
    setUser(me);
    const t = await base44.entities.JobThread.list('-created_date', 50);
    setThreads(t);
    setLoading(false);
  }, []);

  useEffect(() => { fetchThreads(); }, [fetchThreads]);

  const loadMessages = async (thread) => {
    setSelectedThread(thread);
    const msgs = await base44.entities.JobMessage.filter({ thread_id: thread.id });
    setMessages(msgs.sort((a, b) => new Date(a.sent_at) - new Date(b.sent_at)));
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedThread || !user) return;
    // Optimistic update
    const optimistic = {
      id: `optimistic-${Date.now()}`,
      thread_id: selectedThread.id,
      job_id: selectedThread.job_id,
      sender_id: user.id,
      content: newMessage,
      sent_at: new Date().toISOString(),
      _optimistic: true,
    };
    setMessages(prev => [...prev, optimistic]);
    const text = newMessage;
    setNewMessage('');
    setSending(true);
    const created = await base44.entities.JobMessage.create({
      thread_id: selectedThread.id,
      job_id: selectedThread.job_id,
      sender_id: user.id,
      content: text,
      sent_at: optimistic.sent_at,
    });
    setMessages(prev => prev.map(m => m.id === optimistic.id ? created : m));
    setSending(false);
  };

  const threadTypeLabel = { internal_operations: 'Internal', contractor: 'Contractor', client: 'Client' };

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader title="Messages" />

      <div className="grid lg:grid-cols-3 gap-6 h-[70vh]">
        {/* Thread List */}
        <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold text-sm">Threads</h2>
          </div>
          <PullToRefresh onRefresh={fetchThreads}>
          <div className="divide-y divide-border">
            {loading ? (
              [...Array(4)].map((_, i) => <div key={i} className="h-14 mx-4 my-2 bg-muted rounded animate-pulse" />)
            ) : threads.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No threads</div>
            ) : (
              threads.map(t => (
                <button key={t.id} onClick={() => loadMessages(t)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors ${selectedThread?.id === t.id ? 'bg-primary/5' : ''}`}>
                  <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{threadTypeLabel[t.thread_type] || t.thread_type}</p>
                    <p className="text-xs text-muted-foreground truncate">Job thread</p>
                  </div>
                </button>
              ))
            )}
          </div>
          </PullToRefresh>
        </div>

        {/* Message Pane */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl flex flex-col overflow-hidden">
          {!selectedThread ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                Select a thread to view messages
              </div>
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-border">
                <p className="text-sm font-semibold">{threadTypeLabel[selectedThread.thread_type]} Thread</p>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map(m => {
                  const isMe = m.sender_id === user?.id;
                  return (
                    <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] px-3 py-2 rounded-xl text-sm ${isMe ? 'bg-primary text-white' : 'bg-muted'}`}>
                        {m.content}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="p-4 border-t border-border flex gap-2">
                <Input placeholder="Type a message..." value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} />
                <Button size="icon" onClick={handleSend} disabled={sending || !newMessage.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}