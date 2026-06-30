import { describe, it, expect } from 'vitest';
import { lastNMonthKeys, bucketByMonth } from './timeseries';

const NOW = new Date(2026, 5, 15); // 2026-06-15 (local)

describe('lastNMonthKeys', () => {
  it('returns n consecutive keys ending at the current month', () => {
    expect(lastNMonthKeys(3, NOW)).toEqual(['2026-04', '2026-05', '2026-06']);
  });
  it('crosses the year boundary correctly', () => {
    expect(lastNMonthKeys(3, new Date(2026, 0, 10))).toEqual(['2025-11', '2025-12', '2026-01']);
  });
});

describe('bucketByMonth', () => {
  const rows = [
    { d: '2026-06-01T09:00:00Z', v: 100 },
    { d: '2026-06-20', v: 50 },
    { d: '2026-05-02', v: 200 },
    { d: '2026-01-02', v: 999 }, // outside a 3-month window
    { d: null, v: 1 }, // ignored
  ];

  it('sums values into the right months and zero-fills gaps', () => {
    const out = bucketByMonth(rows, (r) => r.d, (r) => r.v, 3, NOW);
    expect(out.map((b) => [b.month, b.value])).toEqual([
      ['2026-04', 0],
      ['2026-05', 200],
      ['2026-06', 150],
    ]);
  });

  it('excludes records outside the window', () => {
    const out = bucketByMonth(rows, (r) => r.d, (r) => r.v, 3, NOW);
    expect(out.find((b) => b.month === '2026-01')).toBeUndefined();
  });

  it('produces friendly labels', () => {
    const out = bucketByMonth<{ d: string; v: number }>([], (r) => r.d, (r) => r.v, 2, NOW);
    expect(out.map((b) => b.label)).toEqual(['May 26', 'Jun 26']);
  });

  it('accepts Date objects as well as ISO strings', () => {
    const out = bucketByMonth(
      [{ d: new Date(2026, 5, 9), v: 10 }],
      (r) => r.d,
      (r) => r.v,
      1,
      NOW,
    );
    expect(out[0]?.value).toBe(10);
  });
});
