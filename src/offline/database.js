import Dexie from 'dexie';

/**
 * Local IndexedDB store (Dexie) for offline resilience on poor-signal sites
 * (upgrade plan, step 9).
 *   - outbox: actions taken while offline, replayed when connectivity returns.
 *   - drafts: unsent form/composer content, keyed by a caller-chosen string.
 */
export const db = new Dexie('ccg-offline');
db.version(1).stores({
  outbox: '++id, kind, createdAt',
  drafts: 'key, updatedAt',
});
