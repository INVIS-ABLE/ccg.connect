/**
 * Pure notification templates (upgrade plan, step 10). Keeping the copy here makes
 * it testable and consistent across channels (in-app/email/SMS/push). The server
 * notification service turns these into delivered notifications.
 */
export type NotificationType =
  | 'job_assigned'
  | 'job_status_changed'
  | 'timesheet_approved'
  | 'timesheet_returned';

export interface NotificationTemplate {
  notification_type: NotificationType;
  title: string;
  body: string;
  deep_link: string;
}

/** Human-friendly labels for the job statuses surfaced in notifications. */
const STATUS_LABELS: Record<string, string> = {
  enquiry: 'Enquiry',
  quoted: 'Quote sent',
  viewing: 'Viewing booked',
  confirmed: 'Confirmed',
  in_progress: 'In progress',
  support: 'Support',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function jobStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status.replace(/_/g, ' ');
}

export function jobStatusChanged(jobTitle: string, status: string): NotificationTemplate {
  return {
    notification_type: 'job_status_changed',
    title: 'Job status updated',
    body: `“${jobTitle}” is now ${jobStatusLabel(status)}.`,
    deep_link: '/contractor/jobs',
  };
}

export function jobAssigned(jobTitle: string): NotificationTemplate {
  return {
    notification_type: 'job_assigned',
    title: 'New job assigned',
    body: `You've been assigned to “${jobTitle}”.`,
    deep_link: '/contractor/jobs',
  };
}

export function timesheetReviewed(status: string, weekStart: string): NotificationTemplate {
  const approved = status === 'approved' || status === 'paid' || status === 'exported';
  return {
    notification_type: approved ? 'timesheet_approved' : 'timesheet_returned',
    title: approved ? 'Timesheet approved' : 'Timesheet needs attention',
    body: approved
      ? `Your timesheet for week of ${weekStart} was ${status}.`
      : `Your timesheet for week of ${weekStart} was marked “${status.replace(/_/g, ' ')}”.`,
    deep_link: '/contractor/timesheets',
  };
}
