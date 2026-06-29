import { drizzle } from 'drizzle-orm/d1';
import { and, eq, isNull } from 'drizzle-orm';
import { notifications, userProfiles } from '../db/schema';
import { user as authUser } from '../db/auth-schema';
import type { Bindings } from '../env';
import { novuTrigger } from './integrations/novu';

/**
 * Channel-independent notification service (upgrade plan, step 10). Always writes
 * the user-facing in-app notification to D1 (the one bell users see), then hands
 * off to external channel adapters (Novu) which are no-ops unless configured.
 * Designed to be called via `waitUntil` — it never throws.
 */
export interface NotifyInput {
  userId: string;
  jobId?: string | null;
  notification_type: string;
  title: string;
  body?: string;
  deep_link?: string;
  /** Skip if an unread notification of this type already exists for user+job. */
  dedupe?: boolean;
}

export async function notify(env: Bindings, input: NotifyInput): Promise<void> {
  try {
    const db = drizzle(env.DB);

    if (input.dedupe && input.jobId) {
      const existing = await db
        .select({ id: notifications.id })
        .from(notifications)
        .where(
          and(
            eq(notifications.user_id, input.userId),
            eq(notifications.notification_type, input.notification_type),
            eq(notifications.job_id, input.jobId),
            isNull(notifications.read_at),
          ),
        )
        .limit(1);
      if (existing[0]) return;
    }

    await db.insert(notifications).values({
      user_id: input.userId,
      job_id: input.jobId ?? null,
      notification_type: input.notification_type,
      title: input.title,
      body: input.body ?? null,
      deep_link: input.deep_link ?? null,
      channel: 'in_app',
      delivery_status: 'delivered',
      sent_at: new Date().toISOString(),
    });

    // Look up the recipient's contact details so Novu can deliver email/SMS
    // (it upserts the subscriber from these).
    const authRow = (
      await db.select({ email: authUser.email, name: authUser.name }).from(authUser).where(eq(authUser.id, input.userId)).limit(1)
    )[0];
    const profRow = (
      await db
        .select({ phone: userProfiles.phone, first_name: userProfiles.first_name, last_name: userProfiles.last_name, email: userProfiles.email })
        .from(userProfiles)
        .where(eq(userProfiles.user_id, input.userId))
        .limit(1)
    )[0];

    await novuTrigger(env, {
      userId: input.userId,
      type: input.notification_type,
      title: input.title,
      body: input.body ?? '',
      deepLink: input.deep_link,
      email: authRow?.email ?? profRow?.email ?? null,
      phone: profRow?.phone ?? null,
      firstName: profRow?.first_name ?? null,
      lastName: profRow?.last_name ?? null,
    });
  } catch {
    /* notifications must never break the originating action */
  }
}
