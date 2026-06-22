import { describe, it, expect } from 'vitest';
import { daysUntil, dueReminder, dueReminders, type CredentialForExpiry } from './expiry';

const NOW = new Date('2026-06-01T00:00:00Z');

function cred(overrides: Partial<CredentialForExpiry> = {}): CredentialForExpiry {
  return {
    id: 'cr-1',
    expiry_date: null,
    reminder_7_sent: false,
    reminder_14_sent: false,
    reminder_30_sent: false,
    reminder_60_sent: false,
    ...overrides,
  };
}

const plusDays = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();

describe('daysUntil', () => {
  it('counts whole days ahead', () => {
    expect(daysUntil(plusDays(30), NOW)).toBe(30);
  });
  it('is negative once expired', () => {
    expect(daysUntil(plusDays(-3), NOW)).toBe(-3);
  });
});

describe('dueReminder threshold selection', () => {
  it('no reminder beyond 60 days', () => {
    expect(dueReminder(cred({ expiry_date: plusDays(61) }), NOW)).toBeNull();
  });
  it('picks the 60-day reminder at 60 and within the 31–60 band', () => {
    expect(dueReminder(cred({ expiry_date: plusDays(60) }), NOW)?.threshold).toBe(60);
    expect(dueReminder(cred({ expiry_date: plusDays(45) }), NOW)?.threshold).toBe(60);
  });
  it('picks 30 / 14 / 7 in their bands', () => {
    expect(dueReminder(cred({ expiry_date: plusDays(30) }), NOW)?.threshold).toBe(30);
    expect(dueReminder(cred({ expiry_date: plusDays(20) }), NOW)?.threshold).toBe(30);
    expect(dueReminder(cred({ expiry_date: plusDays(14) }), NOW)?.threshold).toBe(14);
    expect(dueReminder(cred({ expiry_date: plusDays(8) }), NOW)?.threshold).toBe(14);
    expect(dueReminder(cred({ expiry_date: plusDays(7) }), NOW)?.threshold).toBe(7);
  });
  it('still fires the 7-day reminder when already expired', () => {
    expect(dueReminder(cred({ expiry_date: plusDays(-5) }), NOW)?.threshold).toBe(7);
  });
  it('does not re-fire a threshold already sent', () => {
    expect(dueReminder(cred({ expiry_date: plusDays(20), reminder_30_sent: true }), NOW)).toBeNull();
  });
  it('returns the right flag to set', () => {
    expect(dueReminder(cred({ expiry_date: plusDays(10) }), NOW)?.flag).toBe('reminder_14_sent');
  });
  it('ignores credentials with no expiry date', () => {
    expect(dueReminder(cred({ expiry_date: null }), NOW)).toBeNull();
  });
});

describe('dueReminders', () => {
  it('returns one reminder per due credential, skipping the rest', () => {
    const due = dueReminders(
      [
        cred({ id: 'a', expiry_date: plusDays(5) }),
        cred({ id: 'b', expiry_date: plusDays(100) }), // too far
        cred({ id: 'c', expiry_date: plusDays(13), reminder_14_sent: true }), // already sent
        cred({ id: 'd', expiry_date: plusDays(25) }),
      ],
      NOW,
    );
    expect(due.map((r) => r.credentialId)).toEqual(['a', 'd']);
    expect(due.map((r) => r.threshold)).toEqual([7, 30]);
  });
});
