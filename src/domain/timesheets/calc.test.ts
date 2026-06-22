import { describe, it, expect } from 'vitest';
import { entryHours, timesheetTotals } from './calc';

describe('entryHours', () => {
  it('computes a normal day shift', () => {
    expect(entryHours({ start_time: '08:00', finish_time: '16:30' })).toBe(8.5);
  });

  it('subtracts the break', () => {
    expect(entryHours({ start_time: '08:00', finish_time: '16:00', break_minutes: 30 })).toBe(7.5);
  });

  it('handles an overnight shift (finish before start)', () => {
    // 22:00 → 06:00 = 8h
    expect(entryHours({ start_time: '22:00', finish_time: '06:00' })).toBe(8);
  });

  it('handles overnight with a break', () => {
    expect(entryHours({ start_time: '20:00', finish_time: '04:30', break_minutes: 45 })).toBe(7.75);
  });

  it('never returns negative hours when the break exceeds the shift', () => {
    expect(entryHours({ start_time: '09:00', finish_time: '09:30', break_minutes: 60 })).toBe(0);
  });

  it('rounds to 2dp', () => {
    // 08:00 → 08:20 = 20min = 0.333.. → 0.33
    expect(entryHours({ start_time: '08:00', finish_time: '08:20' })).toBe(0.33);
  });

  it('rejects malformed times', () => {
    expect(() => entryHours({ start_time: '8am', finish_time: '16:00' })).toThrow();
    expect(() => entryHours({ start_time: '25:00', finish_time: '26:00' })).toThrow();
  });
});

describe('timesheetTotals', () => {
  it('sums hours and pay across entries', () => {
    const t = timesheetTotals([
      { start_time: '08:00', finish_time: '16:00', break_minutes: 30, rate: 20 }, // 7.5h * 20 = 150
      { start_time: '08:00', finish_time: '12:00', rate: 20 }, // 4h * 20 = 80
    ]);
    expect(t.totalHours).toBe(11.5);
    expect(t.totalAmount).toBe(230);
    expect(t.entries).toEqual([
      { hours: 7.5, amount: 150 },
      { hours: 4, amount: 80 },
    ]);
  });

  it('treats a missing rate as zero pay', () => {
    const t = timesheetTotals([{ start_time: '09:00', finish_time: '17:00' }]);
    expect(t.totalHours).toBe(8);
    expect(t.totalAmount).toBe(0);
  });

  it('is empty-safe', () => {
    expect(timesheetTotals([])).toEqual({ totalHours: 0, totalAmount: 0, entries: [] });
  });
});
