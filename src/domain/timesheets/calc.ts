import { round2 } from '../shared/number';

/**
 * Timesheet hour/pay calculations. Pure and unit-tested (CLAUDE.md: overnight
 * shifts, breaks, rounding). Times are "HH:MM" (24h). A finish at or before the
 * start is treated as an overnight shift (finish on the next day).
 */
export interface TimeEntryInput {
  start_time: string;
  finish_time: string;
  break_minutes?: number;
  rate?: number;
}

function parseHHMM(value: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) throw new Error(`Invalid time "${value}", expected HH:MM`);
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) throw new Error(`Invalid time "${value}"`);
  return h * 60 + m;
}

/** Worked hours for one entry: (finish − start − break), overnight-aware, ≥ 0. */
export function entryHours(entry: TimeEntryInput): number {
  const start = parseHHMM(entry.start_time);
  let finish = parseHHMM(entry.finish_time);
  if (finish <= start) finish += 24 * 60; // overnight shift
  const worked = finish - start - (entry.break_minutes ?? 0);
  return round2(Math.max(0, worked) / 60);
}

export interface TimesheetTotals {
  totalHours: number;
  totalAmount: number;
  /** Per-entry breakdown in input order. */
  entries: { hours: number; amount: number }[];
}

/** Totals for a timesheet. Per-entry amount uses the entry rate (defaults 0). */
export function timesheetTotals(entries: TimeEntryInput[]): TimesheetTotals {
  const rows = entries.map((e) => {
    const hours = entryHours(e);
    const amount = round2(hours * (e.rate ?? 0));
    return { hours, amount };
  });
  const totalHours = round2(rows.reduce((sum, r) => sum + r.hours, 0));
  const totalAmount = round2(rows.reduce((sum, r) => sum + r.amount, 0));
  return { totalHours, totalAmount, entries: rows };
}
