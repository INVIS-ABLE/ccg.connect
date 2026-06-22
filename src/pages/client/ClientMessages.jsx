import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PageHeader from '@/components/shared/PageHeader';

export default function ClientMessages() {
  const [threads, setThreads] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    base44.auth.me().then(me => {
      setUser(me);
      return base44.entities.JobThread.filter({ thread_type: 'client', client_visible: true });
    }).then(t => {
      setThreads(t);
      setLoading(false);
    });
  }, []);

  const loadMessages = async (thread) => {
    setSelectedThread(thread);
    const msgs = await base44.entities.JobMessage.filter({ thread_id: thread.id });
    setMessages(msgs);
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedThread || !user) return;
    setSending(true);
    const created = await base44.entities.JobMessage.create({
      thread_id: selectedThread.id,
      job_id: selectedThread.job_id,
      sender_id: user.id,
      content: newMessage,
      sent_at: new Date().toISOString(),
    });
    setMessages(prev => [...prev, created]);
    setNewMessage('');
    setSending(false);
  };

  if (selectedThread) {
    return (
      <div className="flex flex-col h-full max-w-2xl mx-auto">
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <button onClick={() => setSelectedThread(null)} className="text-sm text-primary hover:underline">← Back</button>
          <h2 className="text-sm font-semibold">Messages</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map(m => {
            const isMe = m.sender_id === user?.id;
            return (
              <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] px-3 py-2 rounded-xl text-sm ${isMe ? 'bg-primary text-white' : 'bg-card border border-border'}`}>
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
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <PageHeader title="Messages" />
      {loading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : threads.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">No message threads yet</div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="divide-y divide-border">
            {threads.map(t => (
              <button key={t.id} onClick={() => loadMessages(t)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 text-left">
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-primary text-xs font-bold">CCG</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Job Thread</p>
                  <p className="text-xs text-muted-foreground">Tap to view messages</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}