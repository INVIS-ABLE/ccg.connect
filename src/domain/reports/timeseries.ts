/**
 * Monthly time-series bucketing for the Reports trends.
 *
 * Pure and deterministic — `now` is injected (never `Date.now()`), and month
 * keys are derived by slicing ISO date strings (`yyyy-mm`) so there are no
 * timezone surprises. Months with no data are zero-filled so the chart has a
 * continuous axis.
 */
export interface MonthBucket {
  /** `yyyy-mm` */
  month: string;
  /** Short display label, e.g. `Jan 26`. */
  label: string;
  value: number;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function ym(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function labelFor(key: string): string {
  const [year, month] = key.split('-');
  const idx = Number(month) - 1;
  const name = MONTH_NAMES[idx] ?? month;
  return `${name} ${(year ?? '').slice(2)}`;
}

/** The `yyyy-mm` keys for the last `n` months ending with the month of `now`. */
export function lastNMonthKeys(n: number, now: Date): string[] {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    keys.push(ym(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  }
  return keys;
}

/**
 * Sum `getValue` over `records` into the last `months` monthly buckets, keyed by
 * `getDate` (an ISO string or Date). Records outside the window are ignored.
 */
export function bucketByMonth<T>(
  records: readonly T[],
  getDate: (r: T) => string | Date | null | undefined,
  getValue: (r: T) => number,
  months: number,
  now: Date,
): MonthBucket[] {
  const keys = lastNMonthKeys(months, now);
  const index = new Map(keys.map((k, i) => [k, i]));
  const totals = keys.map(() => 0);
  for (const r of records) {
    const dv = getDate(r);
    if (!dv) continue;
    const key = typeof dv === 'string' ? dv.slice(0, 7) : ym(dv);
    const i = index.get(key);
    if (i === undefined) continue;
    totals[i] = (totals[i] ?? 0) + (getValue(r) || 0);
  }
  return keys.map((k, i) => ({ month: k, label: labelFor(k), value: totals[i] ?? 0 }));
}
