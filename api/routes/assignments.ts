import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { jobAssignments, jobs as jobsTable } from '../db/schema';
import { requireAuth } from '../lib/session';
import { isAdmin, canManageJobs } from '../../src/domain/permissions/permissions';
import type { AppEnv } from '../env';

const route = new Hono<AppEnv>();
route.use('*', requireAuth);

type AssignmentInsert = typeof jobAssignments.$inferInsert;

// GET /api/assignments — role-scoped: admins see all; contractors see their own;
// clients see assignments on their own jobs.
route.get('/', async (c) => {
  const p = c.get('principal');
  const db = drizzle(c.env.DB);

  if (isAdmin(p)) {
    const rows = await db.select().from(jobAssignments).limit(500);
    return c.json({ assignments: rows });
  }
  if (p.role === 'contractor') {
    if (!p.contractorId) return c.json({ assignments: [] });
    const rows = await db
      .select()
      .from(jobAssignments)
      .where(eq(jobAssignments.contractor_id, p.contractorId))
      .limit(500);
    return c.json({ assignments: rows });
  }
  if (p.role === 'client') {
    if (!p.clientId) return c.json({ assignments: [] });
    const rows = await db
      .select({ a: jobAssignments })
      .from(jobAssignments)
      .innerJoin(jobsTable, eq(jobAssignments.job_id, jobsTable.id))
      .where(eq(jobsTable.client_id, p.clientId))
      .limit(500);
    return c.json({ assignments: rows.map((r) => r.a) });
  }
  return c.json({ assignments: [] });
});

// POST /api/assignments — assign a contractor to a job. Admin-only authorised
// action (invariants 12 & 13: assignment is always an admin decision).
route.post('/', async (c) => {
  const p = c.get('principal');
  if (!canManageJobs(p)) return c.json({ error: 'forbidden' }, 403);

  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  const jobId = typeof body?.job_id === 'string' ? body.job_id : null;
  const contractorId = typeof body?.contractor_id === 'string' ? body.contractor_id : null;
  if (!jobId || !contractorId) return c.json({ error: 'job_id_and_contractor_id_required' }, 400);

  const rateType =
    body?.agreed_rate_type === 'hourly' || body?.agreed_rate_type === 'fixed'
      ? body.agreed_rate_type
      : 'daily';

  const values: AssignmentInsert = {
    job_id: jobId,
    contractor_id: contractorId,
    assignment_status: 'active',
    agreed_rate_type: rateType,
    agreed_rate: typeof body?.agreed_rate === 'number' ? body.agreed_rate : null,
    planned_start: typeof body?.planned_start === 'string' ? body.planned_start : null,
    planned_finish: typeof body?.planned_finish === 'string' ? body.planned_finish : null,
    assigned_by: p.userId,
    assigned_at: new Date().toISOString(),
  };
  const db = drizzle(c.env.DB);
  const inserted = await db.insert(jobAssignments).values(values).returning();
  return c.json({ assignment: inserted[0] }, 201);
});

export default route;
