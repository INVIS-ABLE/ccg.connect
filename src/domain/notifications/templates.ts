/**
 * Pure notification templates (upgrade plan, step 10). Keeping the copy here makes
 * it testable and consistent across channels (in-app/email/SMS/push). The server
 * notification service turns these into delivered notifications.
 */
export type NotificationType =
  | 'job_assigned'
  | 'timesheet_approved'
  | 'timesheet_returned';

export interface NotificationTemplate {
  notification_type: NotificationType;
  title: string;
  body: string;
  deep_link: string;
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
