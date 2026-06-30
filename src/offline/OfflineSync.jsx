import { useEffect } from 'react';
import { api } from '@/api/client';
import { registerHandler, flushOutbox } from './syncQueue';

// Map outbox "kinds" to the API calls that replay them. Extend as more flows
// become offline-capable.
registerHandler('sendMessage', (p) => api.messages.send(p.conversationId, p.body, p.replyToId));

/** Mount once near the app root: flushes the offline outbox on load, when the
 *  network returns, and on a slow interval. Renders nothing. */
export function OfflineSync() {
  useEffect(() => {
    void flushOutbox();
    const onOnline = () => void flushOutbox();
    window.addEventListener('online', onOnline);
    const t = setInterval(() => void flushOutbox(), 15000);
    return () => {
      window.removeEventListener('online', onOnline);
      clearInterval(t);
    };
  }, []);
  return null;
}
