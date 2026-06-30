import { describe, it, expect } from 'vitest';
import { rollupMargin, attendanceRollup, countByStatus, topByValue } from './commercialSummary';

describe('rollupMargin', () => {
  it('sums and penny-rounds pay/charge/margin', () => {
    const r = rollupMargin([
      { workerPay: 100.005, employerCost: 10, clientCharge: 150, margin: 39.995 },
      { workerPay: 50, employerCost: 5, clientCharge: 80, margin: 25 },
    ]);
    expect(r.workerPay).toBe(150.01);
    expect(r.employerCost).toBe(15);
    expect(r.clientCharge).toBe(230);
    expect(r.margin).toBe(65);
    expect(r.marginPct).toBe(28.26); // 65 / 230 * 100
  });

  it('returns zero marginPct when nothing was charged', () => {
    const r = rollupMargin([{ workerPay: 0, employerCost: 0, clientCharge: 0, margin: 0 }]);
    expect(r.marginPct).toBe(0);
  });

  it('handles an empty set', () => {
    expect(rollupMargin([])).toEqual({ workerPay: 0, employerCost: 0, clientCharge: 0, margin: 0, marginPct: 0 });
  });
});

describe('attendanceRollup', () => {
  it('counts present and late as turned-up', () => {
    const r = attendanceRollup([
      { status: 'present' }, { status: 'late' }, { status: 'absent' }, { status: 'no_show' },
    ]);
    expect(r.total).toBe(4);
    expect(r.present).toBe(2);
    expect(r.absent).toBe(2);
    expect(r.rate).toBe(50);
  });

  it('is 0% with no records (no divide-by-zero)', () => {
    expect(attendanceRollup([])).toEqual({ total: 0, present: 0, absent: 0, rate: 0 });
  });

  it('rounds the rate to 2dp', () => {
    const recs = [{ status: 'present' }, { status: 'present' }, { status: 'absent' }];
    expect(attendanceRollup(recs).rate).toBe(66.67); // 2/3
  });
});

describe('countByStatus', () => {
  it('tallies by key and buckets nullish as unknown', () => {
    const out = countByStatus(
      [{ s: 'active' }, { s: 'active' }, { s: 'completed' }, { s: null }],
      (r) => r.s,
    );
    expect(out).toEqual({ active: 2, completed: 1, unknown: 1 });
  });
});

describe('topByValue', () => {
  it('sums by key, sorts descending, and limits', () => {
    const rows = [
      { acct: 'A', amt: 100 }, { acct: 'B', amt: 250 },
      { acct: 'A', amt: 50 }, { acct: 'C', amt: 10 },
    ];
    const top = topByValue(rows, (r) => r.acct, (r) => r.amt, 2);
    expect(top).toEqual([{ key: 'B', value: 250 }, { key: 'A', value: 150 }]);
  });

  it('skips rows with no key', () => {
    const top = topByValue([{ k: null, v: 5 }, { k: 'X', v: 3 }], (r) => r.k, (r) => r.v, 5);
    expect(top).toEqual([{ key: 'X', value: 3 }]);
  });
});
