import { useEffect, useRef, useState } from 'react';
import { db } from './database';

/** Persist unsent content (form/composer drafts) in IndexedDB, keyed by a string. */
export async function saveDraft(key, value) {
  await db.drafts.put({ key, value, updatedAt: Date.now() });
}
export async function loadDraft(key) {
  return (await db.drafts.get(key))?.value;
}
export async function clearDraft(key) {
  await db.drafts.delete(key);
}

/**
 * useDraft — a string state that is hydrated from and (debounced) persisted to
 * IndexedDB, so an in-progress message/form survives a refresh or a crash.
 * Returns [value, setValue, clear].
 */
export function useDraft(key, initial = '') {
  const [value, setValue] = useState(initial);
  const timer = useRef(null);

  useEffect(() => {
    let alive = true;
    if (!key) return;
    loadDraft(key).then((v) => {
      if (alive && typeof v === 'string') setValue(v);
    });
    return () => {
      alive = false;
    };
  }, [key]);

  useEffect(() => {
    if (!key) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (value) void saveDraft(key, value);
      else void clearDraft(key);
    }, 400);
    return () => clearTimeout(timer.current);
  }, [key, value]);

  const clear = () => {
    setValue('');
    if (key) void clearDraft(key);
  };

  return [value, setValue, clear];
}
