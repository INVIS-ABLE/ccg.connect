import { Hono, type Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { and, desc, eq } from 'drizzle-orm';
import { kidDocuments, workers, deploymentWorkers } from '../db/schema';
import { requireAuth } from '../lib/session';
import { isAdmin } from '../../src/domain/permissions/permissions';
import { defaultKid } from '../../src/domain/commercial/kid';
import type { AppEnv } from '../env';

/**
 * Key Information Documents (agency workers). Ops author/issue them; a worker
 * acknowledges their own. Admin-only except the owning worker may read and
 * acknowledge. The template is a draft pending employment-law sign-off and this
 * route never determines tax/employment status (see src/domain/commercial/kid.ts).
 */
const route = new Hono<AppEnv>();
route.use('*', requireAuth);

const admin = (c: Context<AppEnv>) => isAdmin(c.get('principal'));
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

// Editable content fields (everything except identity / lifecycle metadata).
const FIELDS = [
  'employment_business', 'contract_type', 'payment_model', 'pay_frequency', 'paid_by',
  'deductions', 'holiday_entitlement', 'holiday_pay', 'other_fees', 'example_calculation', 'notes',
] as const;

async function callerWorkerId(db: ReturnType<typeof drizzle>, userId: string): Promise<string | null> {
  const row = (await db.select({ id: workers.id }).from(workers).where(eq(workers.user_id, userId)).limit(1))[0];
  return row?.id ?? null;
}

// GET /api/kids?deployment_id=… — KIDs for a deployment (admin).
route.get('/', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const deploymentId = c.req.query('deployment_id');
  if (!deploymentId) return c.json({ error: 'deployment_id_required' }, 400);
  const rows = await db.select().from(kidDocuments)
    .where(eq(kidDocuments.deployment_id, deploymentId))
    .orderBy(desc(kidDocuments.created_at)).all();
  return c.json({ kids: rows });
});

// GET /api/kids/:id — admin, or the worker the document belongs to.
route.get('/:id', async (c) => {
  const me = c.get('principal');
  const db = drizzle(c.env.DB);
  const kid = (await db.select().from(kidDocuments).where(eq(kidDocuments.id, c.req.param('id'))).limit(1))[0];
  if (!kid) return c.json({ error: 'not_found' }, 404);
  if (!admin(c)) {
    const myWorkerId = await callerWorkerId(db, me.userId);
    if (kid.worker_id !== myWorkerId) return c.json({ error: 'forbidden' }, 403);
  }
  return c.json({ kid });
});

// POST /api/kids — create a draft KID for a worker on a deployment (admin).
route.post('/', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const me = c.get('principal');
  const db = drizzle(c.env.DB);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const deploymentId = str(body.deployment_id);
  const workerId = str(body.worker_id);
  if (!deploymentId || !workerId) return c.json({ error: 'deployment_and_worker_required' }, 400);

  const worker = (await db.select({ payment_model: workers.payment_model }).from(workers).where(eq(workers.id, workerId)).limit(1))[0];
  const dw = (await db.select({ pay_rate: deploymentWorkers.pay_rate }).from(deploymentWorkers)
    .where(and(eq(deploymentWorkers.deployment_id, deploymentId), eq(deploymentWorkers.worker_id, workerId))).limit(1))[0];

  const prefill = defaultKid({ paymentModel: worker?.payment_model ?? null, payRate: dw?.pay_rate ?? null });
  const inserted = await db.insert(kidDocuments).values({
    deployment_id: deploymentId, worker_id: workerId, status: 'draft', version: 1,
    pay_rate: prefill.pay_rate ?? null, ...prefill, created_by: me.userId,
  }).returning();
  return c.json({ kid: inserted[0] }, 201);
});

// PATCH /api/kids/:id — edit fields, issue, or supersede (admin).
route.patch('/:id', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const id = c.req.param('id');
  const current = (await db.select().from(kidDocuments).where(eq(kidDocuments.id, id)).limit(1))[0];
  if (!current) return c.json({ error: 'not_found' }, 404);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;

  const patch: Record<string, unknown> = {};
  let contentChanged = false;
  for (const f of FIELDS) if (f in body) { patch[f] = body[f] === '' ? null : body[f]; contentChanged = true; }
  if ('pay_rate' in body) { patch.pay_rate = num(body.pay_rate); contentChanged = true; }

  // Editing a KID that's already been acknowledged supersedes it: bump the
  // version and require a fresh acknowledgement (the worker agreed to old terms).
  if (contentChanged && current.status === 'acknowledged') {
    patch.version = current.version + 1;
    patch.status = 'issued';
    patch.issued_at = new Date().toISOString();
    patch.acknowledged_at = null;
    patch.acknowledged_signature = null;
  } else if (body.status === 'issued' && current.status === 'draft') {
    patch.status = 'issued';
    patch.issued_at = new Date().toISOString();
  } else if (body.status === 'superseded') {
    patch.status = 'superseded';
  }

  if (Object.keys(patch).length === 0) return c.json({ error: 'nothing_to_update' }, 400);
  const updated = await db.update(kidDocuments).set({ ...patch, updated_at: new Date() }).where(eq(kidDocuments.id, id)).returning();
  return c.json({ kid: updated[0] });
});

// POST /api/kids/:id/acknowledge — the worker (or ops on their behalf) signs.
route.post('/:id/acknowledge', async (c) => {
  const me = c.get('principal');
  const db = drizzle(c.env.DB);
  const id = c.req.param('id');
  const kid = (await db.select().from(kidDocuments).where(eq(kidDocuments.id, id)).limit(1))[0];
  if (!kid) return c.json({ error: 'not_found' }, 404);

  if (!admin(c)) {
    const myWorkerId = await callerWorkerId(db, me.userId);
    if (kid.worker_id !== myWorkerId) return c.json({ error: 'forbidden' }, 403);
  }
  if (kid.status !== 'issued') return c.json({ error: 'not_issued' }, 400);

  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const signature = str(body.signature);
  if (!signature) return c.json({ error: 'signature_required' }, 400);

  const updated = await db.update(kidDocuments)
    .set({ status: 'acknowledged', acknowledged_at: new Date().toISOString(), acknowledged_signature: signature, updated_at: new Date() })
    .where(eq(kidDocuments.id, id)).returning();
  return c.json({ kid: updated[0] });
});

export default route;
