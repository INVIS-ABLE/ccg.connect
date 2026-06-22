import { drizzle } from 'drizzle-orm/d1';
import { and, eq, isNotNull } from 'drizzle-orm';
import { contractorCredentials, contractorProfiles, notifications } from '../db/schema';
import { dueReminders, type Threshold } from '../../src/domain/credentials/expiry';
import type { Bindings } from '../env';

function flagPatch(threshold: Threshold) {
  switch (threshold) {
    case 7:
      return { reminder_7_sent: true };
    case 14:
      return { reminder_14_sent: true };
    case 30:
      return { reminder_30_sent: true };
    case 60:
      return { reminder_60_sent: true };
  }
}

/**
 * Credential-expiry job (runs from the Worker cron). Finds verified, non-archived
 * credentials nearing expiry, notifies the owning contractor in-app, and marks the
 * reminder threshold sent so it isn't repeated. Idempotent across runs via the
 * reminder_* flags.
 */
export async function runCredentialExpiryJob(env: Bindings, now: Date = new Date()) {
  const db = drizzle(env.DB);

  const creds = await db
    .select()
    .from(contractorCredentials)
    .where(
      and(
        eq(contractorCredentials.verification_status, 'verified'),
        eq(contractorCredentials.archived, false),
        isNotNull(contractorCredentials.expiry_date),
      ),
    );

  const reminders = dueReminders(creds, now);
  if (reminders.length === 0) return { processed: 0 };

  const credById = new Map(creds.map((c) => [c.id, c]));
  let processed = 0;

  for (const reminder of reminders) {
    const cred = credById.get(reminder.credentialId);
    if (!cred) continue;

    const cp = await db
      .select({ user_id: contractorProfiles.user_id })
      .from(contractorProfiles)
      .where(eq(contractorProfiles.id, cred.contractor_id))
      .limit(1);
    const userId = cp[0]?.user_id;

    if (userId) {
      await db.insert(notifications).values({
        user_id: userId,
        notification_type: 'credential_expiry',
        title: 'Credential expiring soon',
        body:
          reminder.daysUntilExpiry >= 0
            ? `A credential expires in ${reminder.daysUntilExpiry} day(s). Please renew it.`
            : 'A credential has expired. Please renew it to stay eligible for work.',
        channel: 'in_app',
        delivery_status: 'sent',
        sent_at: now.toISOString(),
      });
    }

    await db
      .update(contractorCredentials)
      .set(flagPatch(reminder.threshold))
      .where(eq(contractorCredentials.id, cred.id));
    processed += 1;
  }

  return { processed };
}
