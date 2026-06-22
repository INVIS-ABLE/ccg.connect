/**
 * Credential expiry reminders. Pure and unit-tested (CLAUDE.md: expiry-date
 * boundaries). Reminder thresholds are 60/30/14/7 days before expiry; each
 * credential fires at most one reminder per run — the most relevant unsent
 * threshold — so contractors aren't spammed with all four at once.
 */
export const THRESHOLDS = [7, 14, 30, 60] as const;
export type Threshold = (typeof THRESHOLDS)[number];

export const THRESHOLD_FLAG: Record<Threshold, ReminderFlag> = {
  7: 'reminder_7_sent',
  14: 'reminder_14_sent',
  30: 'reminder_30_sent',
  60: 'reminder_60_sent',
};

export type ReminderFlag =
  | 'reminder_7_sent'
  | 'reminder_14_sent'
  | 'reminder_30_sent'
  | 'reminder_60_sent';

export interface CredentialForExpiry {
  id: string;
  expiry_date?: string | null;
  reminder_7_sent: boolean;
  reminder_14_sent: boolean;
  reminder_30_sent: boolean;
  reminder_60_sent: boolean;
}

export interface ExpiryReminder {
  credentialId: string;
  threshold: Threshold;
  flag: ReminderFlag;
  daysUntilExpiry: number;
}

const DAY_MS = 86_400_000;

/** Whole days from `now` until the expiry date (negative if already expired). */
export function daysUntil(expiryIso: string, now: Date): number {
  const expiry = new Date(expiryIso);
  return Math.ceil((expiry.getTime() - now.getTime()) / DAY_MS);
}

/** The single reminder due for a credential right now, or null. */
export function dueReminder(cred: CredentialForExpiry, now: Date): ExpiryReminder | null {
  if (!cred.expiry_date) return null;
  const days = daysUntil(cred.expiry_date, now);
  // Smallest threshold that still covers `days` (e.g. 10 days → the 14-day reminder).
  const threshold = THRESHOLDS.find((t) => t >= days);
  if (threshold === undefined) return null; // more than 60 days away
  const flag = THRESHOLD_FLAG[threshold];
  if (cred[flag]) return null; // already reminded at this threshold
  return { credentialId: cred.id, threshold, flag, daysUntilExpiry: days };
}

export function dueReminders(creds: CredentialForExpiry[], now: Date): ExpiryReminder[] {
  return creds
    .map((c) => dueReminder(c, now))
    .filter((r): r is ExpiryReminder => r !== null);
}
