import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, inArray, desc } from 'drizzle-orm';
import { jobs as jobsTable, jobAssignments } from '../db/schema';
import { requireAuth } from '../lib/session';
import {
  isAdmin,
  canManageJobs,
  canReadJob,
  redactForRole,
  INTERNAL_JOB_FIELDS,
} from '../../src/domain/permissions/permissions';
import type { AppEnv } from '../env';

const route = new Hono<AppEnv>();
route.use('*', requireAuth);

/** Whitelisted fields a client/admin may set on a job (prevents mass-assignment). */
type JobInsert = typeof jobsTable.$inferInsert;
const WRITABLE: (keyof JobInsert)[] = [
  'job_reference', 'client_id', 'title', 'short_description', 'full_scope',
  'site_address', 'site_postcode', 'latitude', 'longitude', 'trade_category',
  'urgency', 'start_date', 'end_date', 'estimated_duration', 'budget',
  'hourly_rate', 'day_rate', 'headcount_required', 'status',
  'client_contact_name', 'client_contact_phone', 'access_instructions',
  'parking_instructions', 'health_and_safety_notes', 'internal_notes',
  'client_visible_notes', 'assignment_locked',
];

function pickWritable(body: Record<string, unknown>): Partial<JobInsert> {
  const out: Record<string, unknown> = {};
  for (const key of WRITABLE) {
    if (key in body && body[key as string] !== undefined) out[key as string] = body[key as string];
  }
  return out as Partial<JobInsert>;
}

// GET /api/jobs — role-scoped list.
route.get('/', async (c) => {
  const p = c.get('principal');
  const db = drizzle(c.env.DB);

  if (isAdmin(p)) {
    const rows = await db.select().from(jobsTable).orderBy(desc(jobsTable.created_at)).limit(200);
    return c.json({ jobs: rows });
  }
  if (p.role === 'client') {
    if (!p.clientId) return c.json({ jobs: [] });
    const rows = await db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.client_id, p.clientId))
      .orderBy(desc(jobsTable.created_at))
      .limit(200);
    return c.json({ jobs: rows.map((j) => redactForRole(p, j, INTERNAL_JOB_FIELDS)) });
  }
  if (p.role === 'contractor') {
    if (!p.contractorId) return c.json({ jobs: [] });
    const assignedJobIds = db
      .select({ id: jobAssignments.job_id })
      .from(jobAssignments)
      .where(eq(jobAssignments.contractor_id, p.contractorId));
    const rows = await db
      .select()
      .from(jobsTable)
      .where(inArray(jobsTable.id, assignedJobIds))
      .orderBy(desc(jobsTable.created_at))
      .limit(200);
    return c.json({ jobs: rows.map((j) => redactForRole(p, j, INTERNAL_JOB_FIELDS)) });
  }
  return c.json({ jobs: [] });
});

// GET /api/jobs/:id
route.get('/:id', async (c) => {
  const p = c.get('principal');
  const db = drizzle(c.env.DB);
  const id = c.req.param('id');

  const rows = await db.select().from(jobsTable).where(eq(jobsTable.id, id)).limit(1);
  const job = rows[0];
  if (!job) return c.json({ error: 'not_found' }, 404);

  const assigned = await db
    .select({ contractor_id: jobAssignments.contractor_id })
    .from(jobAssignments)
    .where(eq(jobAssignments.job_id, id));
  const assignedContractorIds = assigned.map((a) => a.contractor_id);

  if (!canReadJob(p, job, { assignedContractorIds })) {
    return c.json({ error: 'forbidden' }, 403);
  }
  return c.json({ job: redactForRole(p, job, INTERNAL_JOB_FIELDS) });
});

// POST /api/jobs — admin only (invariant 12).
route.post('/', async (c) => {
  const p = c.get('principal');
  if (!canManageJobs(p)) return c.json({ error: 'forbidden' }, 403);

  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  const title = body?.title;
  if (typeof title !== 'string' || title.trim() === '') {
    return c.json({ error: 'title_required' }, 400);
  }

  const db = drizzle(c.env.DB);
  const values = { ...pickWritable(body!), title } as JobInsert;
  const inserted = await db.insert(jobsTable).values(values).returning();
  return c.json({ job: inserted[0] }, 201);
});

// PATCH /api/jobs/:id — admin only.
route.patch('/:id', async (c) => {
  const p = c.get('principal');
  if (!canManageJobs(p)) return c.json({ error: 'forbidden' }, 403);

  const id = c.req.param('id');
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return c.json({ error: 'invalid_body' }, 400);

  const db = drizzle(c.env.DB);
  const updated = await db
    .update(jobsTable)
    .set(pickWritable(body))
    .where(eq(jobsTable.id, id))
    .returning();
  if (!updated[0]) return c.json({ error: 'not_found' }, 404);
  return c.json({ job: updated[0] });
});

export default route;
