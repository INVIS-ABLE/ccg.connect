import { useEffect, useState } from 'react';
import { db } from './database';

/**
 * Offline outbox: queue actions when the network is down and replay them in order
 * when it returns. Handlers are registered by kind (so the queue stays decoupled
 * from the API client).
 */
const handlers = {};

export function registerHandler(kind, fn) {
  handlers[kind] = fn;
}

export async function enqueue(kind, payload) {
  await db.outbox.add({ kind, payload, createdAt: Date.now() });
  window.dispatchEvent(new Event('ccg-outbox-changed'));
}

export async function pendingCount() {
  return db.outbox.count();
}

let flushing = false;

/** Replay queued actions oldest-first; stop at the first failure (likely still
 *  offline) so ordering and at-least-once delivery are preserved. */
export async function flushOutbox() {
  if (flushing || !navigator.onLine) return;
  flushing = true;
  try {
    const items = await db.outbox.orderBy('createdAt').toArray();
    for (const item of items) {
      const fn = handlers[item.kind];
      if (!fn) continue;
      try {
        await fn(item.payload);
        await db.outbox.delete(item.id);
        window.dispatchEvent(new Event('ccg-outbox-changed'));
      } catch {
        break;
      }
    }
  } finally {
    flushing = false;
  }
}

/** React hook: current online state. */
export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

/** React hook: number of queued (unsent) actions. */
export function usePendingCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let alive = true;
    const refresh = () => pendingCount().then((c) => alive && setCount(c));
    refresh();
    window.addEventListener('ccg-outbox-changed', refresh);
    const t = setInterval(refresh, 5000);
    return () => {
      alive = false;
      window.removeEventListener('ccg-outbox-changed', refresh);
      clearInterval(t);
    };
  }, []);
  return count;
}
