import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { jobCheckins, jobAssignments, jobs, userProfiles } from '../db/schema';
import { requireAuth } from '../lib/session';
import { canCheckInToJob } from '../../src/domain/permissions/permissions';
import type { AppEnv } from '../env';

/**
 * On-site check-ins (QR clock-in/out).
 *
 * A contractor scans the job's QR code on arrival/departure; we record the time
 * and, with their permission, their location as site evidence. Authorization is
 * the same membership as a job delivery chat (ops + assigned contractors); the
 * client is never involved (CLAUDE.md invariants 1 & 2). Enforced server-side on
 * every operation.
 */
const route = new Hono<AppEnv>();
route.use('*', requireAuth);

/** Active-assignment contractor ids for a job. */
async function assignedContractorIds(db: ReturnType<typeof drizzle>, jobId: string): Promise<string[]> {
  const rows = await db
    .select({ contractor_id: jobAssignments.contractor_id })
    .from(jobAssignments)
    .where(and(eq(jobAssignments.job_id, jobId), eq(jobAssignments.assignment_status, 'active')))
    .all();
  return rows.map((r) => r.contractor_id);
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

// POST /api/checkins — record a check-in (arrival/departure) for a job.
route.post('/', async (c) => {
  const me = c.get('principal');
  const db = drizzle(c.env.DB);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;

  const jobId = typeof body.job_id === 'string' ? body.job_id : '';
  if (!jobId) return c.json({ error: 'job_id_required' }, 400);

  const job = (await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.id, jobId)).limit(1))[0];
  if (!job) return c.json({ error: 'job_not_found' }, 404);

  const assigned = await assignedContractorIds(db, jobId);
  if (!canCheckInToJob(me, { assignedContractorIds: assigned })) {
    return c.json({ error: 'forbidden' }, 403);
  }

  const checkType = body.check_type === 'departure' ? 'departure' : 'arrival';
  const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 500) : null;
  // The caller's contractor id (when they are the assigned contractor checking in).
  const contractorId =
    me.role === 'contractor' && me.contractorId && assigned.includes(me.contractorId)
      ? me.contractorId
      : null;

  const inserted = await db
    .insert(jobCheckins)
    .values({
      job_id: jobId,
      contractor_id: contractorId,
      user_id: me.userId,
      check_type: checkType,
      checked_in_at: new Date().toISOString(),
      latitude: num(body.latitude),
      longitude: num(body.longitude),
      accuracy_m: num(body.accuracy_m),
      note,
    })
    .returning();

  return c.json({ checkin: inserted[0] }, 201);
});

// GET /api/checkins?job_id=… — check-in history for a job (newest first).
route.get('/', async (c) => {
  const me = c.get('principal');
  const db = drizzle(c.env.DB);
  const jobId = c.req.query('job_id');
  if (!jobId) return c.json({ error: 'job_id_required' }, 400);

  const assigned = await assignedContractorIds(db, jobId);
  if (!canCheckInToJob(me, { assignedContractorIds: assigned })) {
    return c.json({ error: 'forbidden' }, 403);
  }

  const rows = await db
    .select()
    .from(jobCheckins)
    .where(eq(jobCheckins.job_id, jobId))
    .orderBy(desc(jobCheckins.checked_in_at))
    .all();

  // Attach the checker-in's display name.
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const profiles = userIds.length
    ? await db.select().from(userProfiles).where(inArray(userProfiles.user_id, userIds)).all()
    : [];
  const nameByUser = new Map(
    profiles.map((p) => [
      p.user_id,
      [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || p.display_name || p.email || 'User',
    ]),
  );

  return c.json({
    checkins: rows.map((r) => ({
      id: r.id,
      job_id: r.job_id,
      user_id: r.user_id,
      user_name: nameByUser.get(r.user_id) ?? 'User',
      check_type: r.check_type,
      checked_in_at: r.checked_in_at,
      latitude: r.latitude,
      longitude: r.longitude,
      accuracy_m: r.accuracy_m,
      note: r.note,
    })),
  });
});

export default route;
