/**
 * Card / qualification / right-to-work status for the worker passport and
 * (next slice) the compliance matrix. Pure and date-driven; reuses the shared
 * `daysUntil` so expiry maths stays consistent with credential reminders.
 */
import { daysUntil } from '../credentials/expiry';

export type CardStatus = 'valid' | 'expiring' | 'expired' | 'none';

/** Default window (days) before expiry that a card is flagged as "expiring". */
export const EXPIRING_WINDOW_DAYS = 30;

/**
 * Status of a single card from its expiry date. No expiry → 'none' (e.g. a card
 * that doesn't expire, or one with the date not yet recorded).
 */
export function cardStatus(
  expiry: string | null | undefined,
  now: Date,
  windowDays = EXPIRING_WINDOW_DAYS,
): CardStatus {
  if (!expiry) return 'none';
  const days = daysUntil(expiry, now);
  if (days < 0) return 'expired';
  if (days <= windowDays) return 'expiring';
  return 'valid';
}

/** True only when a card is present and not expired (valid or expiring soon). */
export function cardIsCurrent(expiry: string | null | undefined, now: Date): boolean {
  const s = cardStatus(expiry, now);
  return s === 'valid' || s === 'expiring';
}

/**
 * Whether a worker's right-to-work is currently satisfied: explicitly checked and
 * not lapsed. `restricted`/`expired`/`unchecked` never count as satisfied — RTW
 * must be positively established, never assumed.
 */
export function rightToWorkOk(
  status: 'unchecked' | 'checked' | 'expired' | 'restricted',
  rtwExpiry: string | null | undefined,
  now: Date,
): boolean {
  if (status !== 'checked') return false;
  if (!rtwExpiry) return true; // checked with no recheck date required
  return daysUntil(rtwExpiry, now) >= 0;
}
