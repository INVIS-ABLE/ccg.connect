/**
 * Commercial timesheet approval chain (pure transition rules):
 * worker/gang-leader submits → site manager confirms → CCG ops approves →
 * payroll locks the period → client invoice generated. Rejection returns it to
 * draft for correction.
 */
export const TIMESHEET_STATUSES = [
  'draft',
  'submitted',
  'site_confirmed',
  'ops_approved',
  'locked',
  'invoiced',
  'rejected',
] as const;
export type TimesheetStatus = (typeof TIMESHEET_STATUSES)[number];

const TRANSITIONS: Record<TimesheetStatus, TimesheetStatus[]> = {
  draft: ['submitted'],
  submitted: ['site_confirmed', 'rejected'],
  site_confirmed: ['ops_approved', 'rejected'],
  ops_approved: ['locked', 'rejected'],
  locked: ['invoiced'],
  invoiced: [],
  rejected: ['draft'],
};

export function isTimesheetStatus(value: unknown): value is TimesheetStatus {
  return typeof value === 'string' && (TIMESHEET_STATUSES as readonly string[]).includes(value);
}
export function nextTimesheetStatuses(status: TimesheetStatus): TimesheetStatus[] {
  return TRANSITIONS[status] ?? [];
}
export function canTransitionTimesheet(from: TimesheetStatus, to: TimesheetStatus): boolean {
  return nextTimesheetStatuses(from).includes(to);
}
/** Once locked, hours/rates are frozen (only invoicing remains). */
export function isTimesheetEditable(status: TimesheetStatus): boolean {
  return status === 'draft' || status === 'rejected';
}

const LABELS: Record<TimesheetStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  site_confirmed: 'Site confirmed',
  ops_approved: 'Ops approved',
  locked: 'Locked',
  invoiced: 'Invoiced',
  rejected: 'Rejected',
};
export function timesheetStatusLabel(status: string): string {
  return LABELS[status as TimesheetStatus] ?? status.replace(/_/g, ' ');
}
