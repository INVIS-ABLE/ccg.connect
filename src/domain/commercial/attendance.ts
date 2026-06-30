/**
 * Site attendance / roll-call summary. Pure — counts a day's records against the
 * expected gang and derives the fill rate and replacement need. GPS is never the
 * sole source (large sites, poor signal); an authorised confirmer can always set
 * status, so this works purely off recorded statuses.
 */
export const ATTENDANCE_STATUSES = ['present', 'late', 'absent', 'no_show'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export function isAttendanceStatus(value: unknown): value is AttendanceStatus {
  return typeof value === 'string' && (ATTENDANCE_STATUSES as readonly string[]).includes(value);
}

export interface AttendanceRecord {
  worker_id: string;
  status: AttendanceStatus;
  replacement_needed?: boolean;
}

export interface AttendanceSummary {
  expected: number;
  present: number;
  late: number;
  absent: number;
  noShow: number;
  unrecorded: number;
  replacementNeeded: number;
  /** Proportion of the expected gang on site (present or late), 0..1. */
  fillRate: number;
}

/** `present` and `late` both count as on site for fulfilment. */
export function isOnSite(status: AttendanceStatus): boolean {
  return status === 'present' || status === 'late';
}

export function attendanceSummary(
  records: readonly AttendanceRecord[],
  expectedWorkerIds: readonly string[],
): AttendanceSummary {
  const expected = expectedWorkerIds.length;
  const byWorker = new Map(records.map((r) => [r.worker_id, r]));
  let present = 0, late = 0, absent = 0, noShow = 0, unrecorded = 0, replacementNeeded = 0;
  for (const id of expectedWorkerIds) {
    const r = byWorker.get(id);
    if (!r) { unrecorded += 1; continue; }
    if (r.status === 'present') present += 1;
    else if (r.status === 'late') late += 1;
    else if (r.status === 'absent') absent += 1;
    else if (r.status === 'no_show') noShow += 1;
    if (r.replacement_needed) replacementNeeded += 1;
  }
  const onSite = present + late;
  return {
    expected,
    present,
    late,
    absent,
    noShow,
    unrecorded,
    replacementNeeded,
    fillRate: expected > 0 ? Math.round((onSite / expected) * 100) / 100 : 0,
  };
}
