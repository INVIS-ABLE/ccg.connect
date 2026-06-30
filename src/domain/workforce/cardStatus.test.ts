import { describe, it, expect } from 'vitest';
import { cardStatus, cardIsCurrent, rightToWorkOk } from './cardStatus';

const NOW = new Date('2026-06-15T00:00:00Z');
const inDays = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();

describe('cardStatus', () => {
  it('is "none" when no expiry is set', () => {
    expect(cardStatus(null, NOW)).toBe('none');
    expect(cardStatus(undefined, NOW)).toBe('none');
  });
  it('is "valid" when comfortably in date', () => {
    expect(cardStatus(inDays(90), NOW)).toBe('valid');
  });
  it('is "expiring" within the 30-day window', () => {
    expect(cardStatus(inDays(10), NOW)).toBe('expiring');
    expect(cardStatus(inDays(30), NOW)).toBe('expiring');
  });
  it('is "expired" once past', () => {
    expect(cardStatus(inDays(-1), NOW)).toBe('expired');
  });
  it('honours a custom window', () => {
    expect(cardStatus(inDays(45), NOW, 60)).toBe('expiring');
  });
});

describe('cardIsCurrent', () => {
  it('true for valid and expiring, false for expired/none', () => {
    expect(cardIsCurrent(inDays(90), NOW)).toBe(true);
    expect(cardIsCurrent(inDays(5), NOW)).toBe(true);
    expect(cardIsCurrent(inDays(-1), NOW)).toBe(false);
    expect(cardIsCurrent(null, NOW)).toBe(false);
  });
});

describe('rightToWorkOk', () => {
  it('requires an explicit checked status', () => {
    expect(rightToWorkOk('unchecked', null, NOW)).toBe(false);
    expect(rightToWorkOk('restricted', inDays(90), NOW)).toBe(false);
    expect(rightToWorkOk('expired', inDays(90), NOW)).toBe(false);
  });
  it('checked with no recheck date is ok', () => {
    expect(rightToWorkOk('checked', null, NOW)).toBe(true);
  });
  it('checked but lapsed recheck date is not ok', () => {
    expect(rightToWorkOk('checked', inDays(-1), NOW)).toBe(false);
    expect(rightToWorkOk('checked', inDays(30), NOW)).toBe(true);
  });
});
