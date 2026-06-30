/**
 * Pure aggregation helpers for the commercial (agency) management dashboard.
 *
 * These take already-loaded rows and roll them up into the figures the
 * dashboard renders. Kept pure and penny-rounded so the money maths is
 * unit-testable; `now`/IO live in the API route. Margin figures are sensitive
 * and only ever computed for authorised CCG (admin) callers — see payEngine.
 */
import type { PayResult } from '../commercial/payEngine';

const r2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;

/** The subset of pay totals the rollup needs (one per timesheet). */
export type MarginLike = Pick<PayResult, 'workerPay' | 'employerCost' | 'clientCharge' | 'margin'>;

export interface MarginRollup {
  workerPay: number;
  employerCost: number;
  clientCharge: number;
  margin: number;
  /** margin / clientCharge as a percentage (0 when nothing was charged). */
  marginPct: number;
}

/** Sum pay/charge/margin across timesheets; marginPct guards divide-by-zero. */
export function rollupMargin(totals: readonly MarginLike[]): MarginRollup {
  let workerPay = 0;
  let employerCost = 0;
  let clientCharge = 0;
  let margin = 0;
  for (const t of totals) {
    workerPay += t.workerPay || 0;
    employerCost += t.employerCost || 0;
    clientCharge += t.clientCharge || 0;
    margin += t.margin || 0;
  }
  workerPay = r2(workerPay);
  employerCost = r2(employerCost);
  clientCharge = r2(clientCharge);
  margin = r2(margin);
  const marginPct = clientCharge > 0 ? r2((margin / clientCharge) * 100) : 0;
  return { workerPay, employerCost, clientCharge, margin, marginPct };
}

export interface AttendanceRollup {
  total: number;
  present: number;
  absent: number;
  /** (present + late) / total as a percentage; 0 when there are no records. */
  rate: number;
}

/**
 * Attendance reliability. `present` and `late` both count as turned-up;
 * `absent` and `no_show` count against. Anything else is ignored from the
 * present tally but still counts toward the total.
 */
export function attendanceRollup(records: readonly { status: string }[]): AttendanceRollup {
  let present = 0;
  let absent = 0;
  for (const rec of records) {
    if (rec.status === 'present' || rec.status === 'late') present += 1;
    else if (rec.status === 'absent' || rec.status === 'no_show') absent += 1;
  }
  const total = records.length;
  const rate = total > 0 ? r2((present / total) * 100) : 0;
  return { total, present, absent, rate };
}

/** Tally rows by a status-like key, e.g. deployments by lifecycle status. */
export function countByStatus<T>(rows: readonly T[], getStatus: (r: T) => string | null | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const k = getStatus(r) || 'unknown';
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

/**
 * Group a numeric value by a key (e.g. revenue by account), returning the top
 * `limit` rows by descending value. Penny-rounded.
 */
export interface NamedValue {
  key: string;
  value: number;
}
export function topByValue<T>(
  rows: readonly T[],
  getKey: (r: T) => string | null | undefined,
  getValue: (r: T) => number,
  limit: number,
): NamedValue[] {
  const acc = new Map<string, number>();
  for (const r of rows) {
    const k = getKey(r);
    if (!k) continue;
    acc.set(k, (acc.get(k) ?? 0) + (getValue(r) || 0));
  }
  return [...acc.entries()]
    .map(([key, value]) => ({ key, value: r2(value) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, Math.max(0, limit));
}
