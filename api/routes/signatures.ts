import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { jobs, clients } from '../db/schema';
import { requireAuth } from '../lib/session';
import { isAdmin } from '../../src/domain/permissions/permissions';
import { requestSignature } from '../lib/integrations/documenso';
import type { AppEnv } from '../env';

/**
 * E-signature requests via the Documenso adapter (step 10 seam, now wired). The
 * adapter no-ops unless DOCUMENSO_API_KEY is configured, in which case it creates
 * a signature request for the job's client. Admin only.
 */
const route = new Hono<AppEnv>();
route.use('*', requireAuth);

// POST /api/signatures/request — request the client's signature on a job document.
route.post('/request', async (c) => {
  const p = c.get('principal');
  if (!isAdmin(p)) return c.json({ error: 'forbidden' }, 403);

  const body = (await c.req.json().catch(() => ({}))) as { job_id?: string };
  const jobId = typeof body.job_id === 'string' ? body.job_id : null;
  if (!jobId) return c.json({ error: 'job_id_required' }, 400);

  const db = drizzle(c.env.DB);
  const jr = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  const job = jr[0];
  if (!job) return c.json({ error: 'not_found' }, 404);

  let signerEmail: string | null = null;
  let signerName: string | undefined;
  if (job.client_id) {
    const cr = await db
      .select({ email: clients.email, billing_email: clients.billing_email, name: clients.individual_or_company_name })
      .from(clients)
      .where(eq(clients.id, job.client_id))
      .limit(1);
    signerEmail = cr[0]?.email ?? cr[0]?.billing_email ?? null;
    signerName = cr[0]?.name ?? undefined;
  }
  if (!signerEmail) return c.json({ error: 'no_client_email' }, 400);

  const result = await requestSignature(c.env, {
    documentTitle: `Completion record — ${job.title}`,
    signerEmail,
    signerName,
  });
  return c.json(result);
});

export default route;
