/**
 * Labour-request status pipeline. Pure transition rules so the UI and any
 * server-side guard agree on what moves are allowed from each state.
 */
export const LABOUR_REQUEST_STATUSES = [
  'draft',
  'awaiting_approval',
  'open',
  'sourcing',
  'partially_filled',
  'fully_filled',
  'confirmed',
  'active',
  'completed',
  'cancelled',
] as const;
export type LabourRequestStatus = (typeof LABOUR_REQUEST_STATUSES)[number];

// Forward (and a few backward) transitions. `cancelled` is reachable from any
// live state; terminal states have no onward moves.
const TRANSITIONS: Record<LabourRequestStatus, LabourRequestStatus[]> = {
  draft: ['awaiting_approval', 'cancelled'],
  awaiting_approval: ['open', 'draft', 'cancelled'],
  open: ['sourcing', 'cancelled'],
  sourcing: ['partially_filled', 'fully_filled', 'cancelled'],
  partially_filled: ['fully_filled', 'sourcing', 'cancelled'],
  fully_filled: ['confirmed', 'sourcing', 'cancelled'],
  confirmed: ['active', 'cancelled'],
  active: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function isLabourRequestStatus(value: unknown): value is LabourRequestStatus {
  return typeof value === 'string' && (LABOUR_REQUEST_STATUSES as readonly string[]).includes(value);
}

/** Statuses reachable from `status` in one step. */
export function nextStatuses(status: LabourRequestStatus): LabourRequestStatus[] {
  return TRANSITIONS[status] ?? [];
}

/** Whether moving from `from` to `to` is a permitted single-step transition. */
export function canTransition(from: LabourRequestStatus, to: LabourRequestStatus): boolean {
  return nextStatuses(from).includes(to);
}

export function isTerminal(status: LabourRequestStatus): boolean {
  return nextStatuses(status).length === 0;
}

const LABELS: Record<LabourRequestStatus, string> = {
  draft: 'Draft',
  awaiting_approval: 'Awaiting approval',
  open: 'Open',
  sourcing: 'Sourcing',
  partially_filled: 'Partially filled',
  fully_filled: 'Fully filled',
  confirmed: 'Confirmed',
  active: 'Active',
  completed: 'Completed',
  cancelled: 'Cancelled',
};
export function labourRequestStatusLabel(status: string): string {
  return LABELS[status as LabourRequestStatus] ?? status.replace(/_/g, ' ');
}
