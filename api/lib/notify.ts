import { drizzle } from 'drizzle-orm/d1';
import { and, eq, isNull } from 'drizzle-orm';
import { notifications } from '../db/schema';
import type { Bindings } from '../env';

/**
 * In-app notification service. Writes the user-facing notification to D1 — the
 * bell users see in the top bar. Kept channel-aware in the schema so external
 * delivery (email/SMS/push) can be added later, but there is no paid third-party
 * dependency. Designed to be called via `waitUntil` — it never throws.
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
  } catch {
    /* notifications must never break the originating action */
  }
}
