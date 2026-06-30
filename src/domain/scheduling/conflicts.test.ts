import { describe, it, expect } from 'vitest';
import { rangesOverlap, findConflictingBookingIds, type Booking } from './conflicts';

describe('rangesOverlap (inclusive day ranges)', () => {
  it('detects plain overlap', () => {
    expect(rangesOverlap('2026-06-01', '2026-06-05', '2026-06-04', '2026-06-08')).toBe(true);
  });
  it('treats same-day touch as an overlap', () => {
    expect(rangesOverlap('2026-06-01', '2026-06-05', '2026-06-05', '2026-06-09')).toBe(true);
  });
  it('adjacent days do NOT overlap', () => {
    expect(rangesOverlap('2026-06-01', '2026-06-05', '2026-06-06', '2026-06-09')).toBe(false);
  });
  it('a fully contained range overlaps', () => {
    expect(rangesOverlap('2026-06-01', '2026-06-30', '2026-06-10', '2026-06-12')).toBe(true);
  });
});

describe('findConflictingBookingIds', () => {
  it('returns nothing when there are no clashes', () => {
    const bookings: Booking[] = [
      { id: 'a', contractor_id: 'c1', start: '2026-06-01', finish: '2026-06-03' },
      { id: 'b', contractor_id: 'c1', start: '2026-06-05', finish: '2026-06-07' },
    ];
    expect(findConflictingBookingIds(bookings).size).toBe(0);
  });

  it('flags both sides of a double-booking for one contractor', () => {
    const bookings: Booking[] = [
      { id: 'a', contractor_id: 'c1', start: '2026-06-01', finish: '2026-06-05' },
      { id: 'b', contractor_id: 'c1', start: '2026-06-04', finish: '2026-06-06' },
    ];
    const ids = findConflictingBookingIds(bookings);
    expect([...ids].sort()).toEqual(['a', 'b']);
  });

  it('does not clash bookings across different contractors', () => {
    const bookings: Booking[] = [
      { id: 'a', contractor_id: 'c1', start: '2026-06-01', finish: '2026-06-05' },
      { id: 'b', contractor_id: 'c2', start: '2026-06-01', finish: '2026-06-05' },
    ];
    expect(findConflictingBookingIds(bookings).size).toBe(0);
  });

  it('flags every member of a 3-way overlap', () => {
    const bookings: Booking[] = [
      { id: 'a', contractor_id: 'c1', start: '2026-06-01', finish: '2026-06-10' },
      { id: 'b', contractor_id: 'c1', start: '2026-06-05', finish: '2026-06-06' },
      { id: 'c', contractor_id: 'c1', start: '2026-06-09', finish: '2026-06-12' },
    ];
    expect([...findConflictingBookingIds(bookings)].sort()).toEqual(['a', 'b', 'c']);
  });
});
