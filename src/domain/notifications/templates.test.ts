import { describe, it, expect } from 'vitest';
import { jobAssigned, timesheetReviewed } from './templates';

describe('notification templates', () => {
  it('builds a job-assigned notification', () => {
    const t = jobAssigned('Kitchen refit');
    expect(t.notification_type).toBe('job_assigned');
    expect(t.title).toMatch(/assigned/i);
    expect(t.body).toContain('Kitchen refit');
    expect(t.deep_link).toBe('/contractor/jobs');
  });

  it('marks approved/paid/exported timesheets as approved', () => {
    for (const s of ['approved', 'paid', 'exported']) {
      expect(timesheetReviewed(s, '2026-06-01').notification_type).toBe('timesheet_approved');
    }
  });

  it('marks corrections/disputes as returned with readable copy', () => {
    const t = timesheetReviewed('needs_correction', '2026-06-01');
    expect(t.notification_type).toBe('timesheet_returned');
    expect(t.body).toContain('needs correction');
  });
});
