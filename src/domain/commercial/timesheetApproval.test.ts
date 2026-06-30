import { describe, it, expect } from 'vitest';
import {
  isTimesheetStatus,
  nextTimesheetStatuses,
  canTransitionTimesheet,
  isTimesheetEditable,
  timesheetStatusLabel,
} from './timesheetApproval';

describe('timesheet approval chain', () => {
  it('validates membership', () => {
    expect(isTimesheetStatus('locked')).toBe(true);
    expect(isTimesheetStatus('paid')).toBe(false);
  });

  it('follows the approval chain', () => {
    expect(canTransitionTimesheet('draft', 'submitted')).toBe(true);
    expect(canTransitionTimesheet('submitted', 'site_confirmed')).toBe(true);
    expect(canTransitionTimesheet('site_confirmed', 'ops_approved')).toBe(true);
    expect(canTransitionTimesheet('ops_approved', 'locked')).toBe(true);
    expect(canTransitionTimesheet('locked', 'invoiced')).toBe(true);
  });

  it('allows rejection back to draft but not illegal jumps', () => {
    expect(canTransitionTimesheet('submitted', 'rejected')).toBe(true);
    expect(canTransitionTimesheet('rejected', 'draft')).toBe(true);
    expect(canTransitionTimesheet('draft', 'locked')).toBe(false);
    expect(canTransitionTimesheet('invoiced', 'draft')).toBe(false);
  });

  it('is only editable in draft/rejected (locked freezes the period)', () => {
    expect(isTimesheetEditable('draft')).toBe(true);
    expect(isTimesheetEditable('rejected')).toBe(true);
    expect(isTimesheetEditable('locked')).toBe(false);
    expect(isTimesheetEditable('submitted')).toBe(false);
  });

  it('humanises labels', () => {
    expect(timesheetStatusLabel('site_confirmed')).toBe('Site confirmed');
    expect(nextTimesheetStatuses('invoiced')).toEqual([]);
  });
});
