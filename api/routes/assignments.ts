import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { jobAssignments, jobs as jobsTable } from '../db/schema';
import { requireAuth } from '../lib/session';
import { isAdmin } from '../../src/domain/permissions/permissions';
import type { AppEnv } from '../env';

const route = new Hono<AppEnv>();
route.use('*', requireAuth);

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

export default route;
