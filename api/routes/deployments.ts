import { Hono, type Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, inArray, desc } from 'drizzle-orm';
import {
  deployments,
  deploymentWorkers,
  labourRequests,
  gangMembers,
  workers,
  workerCards,
  conversations,
} from '../db/schema';
import { requireAuth } from '../lib/session';
import { isAdmin } from '../../src/domain/permissions/permissions';
import { complianceMatrix, mergeRequirements, RTW_REQUIREMENT } from '../../src/domain/workforce/compliance';
import type { AppEnv } from '../env';

/**
 * Deployments — connect workers (often a gang) to a labour request + site. On
 * confirmation we freeze a compliance snapshot and auto-create the site group
 * chat. Admin-only.
 */
const route = new Hono<AppEnv>();
route.use('*', requireAuth);

const admin = (c: Context<AppEnv>) => isAdmin(c.get('principal'));
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Workers (passport + cards) for a deployment, shaped for the compliance matrix. */
async function deploymentWorkerInputs(db: ReturnType<typeof drizzle>, deploymentId: string) {
  const dws = await db.select().from(deploymentWorkers).where(eq(deploymentWorkers.deployment_id, deploymentId)).all();
  const ids = dws.map((d) => d.worker_id);
  const wrows = ids.length ? await db.select().from(workers).where(inArray(workers.id, ids)).all() : [];
  const crows = ids.length ? await db.select().from(workerCards).where(inArray(workerCards.worker_id, ids)).all() : [];
  const cardsByWorker = new Map<string, typeof crows>();
  for (const cd of crows) {
    const arr = cardsByWorker.get(cd.worker_id) ?? [];
    arr.push(cd);
    cardsByWorker.set(cd.worker_id, arr);
  }
  const byId = new Map(wrows.map((w) => [w.id, w]));
  return { dws, workersById: byId, cardsByWorker };
}

/** Required checks for a request: RTW + its comma-separated minimum qualifications. */
function requestRequirements(req: { minimum_qualifications: string | null }): string[] {
  const quals = (req.minimum_qualifications ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return mergeRequirements([RTW_REQUIREMENT], quals);
}

route.get('/', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const requestId = c.req.query('labour_request_id');
  const rows = requestId
    ? await db.select().from(deployments).where(eq(deployments.labour_request_id, requestId)).all()
    : await db.select().from(deployments).orderBy(desc(deployments.created_at)).all();
  return c.json({ deployments: rows });
});

route.get('/:id', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const id = c.req.param('id');
  const dep = (await db.select().from(deployments).where(eq(deployments.id, id)).limit(1))[0];
  if (!dep) return c.json({ error: 'not_found' }, 404);

  const req = (await db.select().from(labourRequests).where(eq(labourRequests.id, dep.labour_request_id)).limit(1))[0] ?? null;
  const { dws, workersById, cardsByWorker } = await deploymentWorkerInputs(db, id);
  const members = dws.map((d) => {
    const w = workersById.get(d.worker_id);
    return {
      id: d.id,
      worker_id: d.worker_id,
      role: d.role,
      pay_rate: d.pay_rate,
      charge_rate: d.charge_rate,
      worker: w ? { ...w, cards: cardsByWorker.get(d.worker_id) ?? [] } : null,
    };
  });

  // Live compliance against the request's requirements.
  const requirements = req ? requestRequirements(req) : [RTW_REQUIREMENT];
  const matrixInputs = members
    .filter((m) => m.worker)
    .map((m) => ({
      id: m.worker_id,
      full_name: m.worker!.full_name,
      right_to_work_status: m.worker!.right_to_work_status,
      rtw_expiry: m.worker!.rtw_expiry,
      cards: m.worker!.cards ?? [],
    }));
  const compliance = complianceMatrix(matrixInputs, requirements, new Date());

  return c.json({ deployment: dep, request: req, requirements, members, compliance });
});

route.post('/', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const me = c.get('principal');
  const db = drizzle(c.env.DB);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;

  const requestId = str(body.labour_request_id);
  if (!requestId) return c.json({ error: 'labour_request_id_required' }, 400);
  const req = (await db.select().from(labourRequests).where(eq(labourRequests.id, requestId)).limit(1))[0];
  if (!req) return c.json({ error: 'request_not_found' }, 404);

  // Worker ids come either from an explicit list or by expanding a gang.
  let workerIds: string[] = Array.isArray(body.worker_ids)
    ? (body.worker_ids as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];
  const gangId = str(body.gang_id);
  if (gangId) {
    const gm = await db.select({ worker_id: gangMembers.worker_id }).from(gangMembers).where(eq(gangMembers.gang_id, gangId)).all();
    workerIds = [...new Set([...workerIds, ...gm.map((m) => m.worker_id)])];
  }

  const inserted = await db.insert(deployments).values({
    labour_request_id: requestId,
    account_id: req.account_id,
    site_id: req.site_id,
    gang_id: gangId,
    start_date: str(body.start_date) ?? req.start_date,
    finish_date: str(body.finish_date) ?? req.finish_date,
    notes: str(body.notes),
    created_by: me.userId,
  }).returning();
  const deployment = inserted[0]!;

  // Attach workers (idempotent via unique index).
  for (const wid of workerIds) {
    try {
      await db.insert(deploymentWorkers).values({ deployment_id: deployment.id, worker_id: wid });
    } catch {
      /* already attached */
    }
  }
  return c.json({ deployment }, 201);
});

route.post('/:id/confirm', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const id = c.req.param('id');
  const dep = (await db.select().from(deployments).where(eq(deployments.id, id)).limit(1))[0];
  if (!dep) return c.json({ error: 'not_found' }, 404);
  if (dep.status === 'cancelled') return c.json({ error: 'cancelled' }, 400);

  const req = (await db.select().from(labourRequests).where(eq(labourRequests.id, dep.labour_request_id)).limit(1))[0] ?? null;
  const { dws, workersById, cardsByWorker } = await deploymentWorkerInputs(db, id);
  const requirements = req ? requestRequirements(req) : [RTW_REQUIREMENT];
  const inputs = dws
    .map((d) => workersById.get(d.worker_id))
    .filter((w): w is NonNullable<typeof w> => !!w)
    .map((w) => ({
      id: w.id,
      full_name: w.full_name,
      right_to_work_status: w.right_to_work_status,
      rtw_expiry: w.rtw_expiry,
      cards: cardsByWorker.get(w.id) ?? [],
    }));
  const now = new Date();
  const snapshot = { at: now.toISOString(), requirements, rows: complianceMatrix(inputs, requirements, now) };

  // Auto-create the site group chat (idempotent on pair_key) and link it.
  const pairKey = `deployment:${id}`;
  let conversationId = dep.conversation_id;
  if (!conversationId) {
    const existing = (await db.select({ id: conversations.id }).from(conversations).where(eq(conversations.pair_key, pairKey)).limit(1))[0];
    if (existing) {
      conversationId = existing.id;
    } else {
      const title = req?.title ? `Site — ${req.title}` : 'Site chat';
      const created = (await db.insert(conversations).values({
        kind: 'site', pair_key: pairKey, deployment_id: id, title,
      }).returning())[0];
      conversationId = created?.id ?? null;
    }
  }

  const updated = await db.update(deployments).set({
    status: 'confirmed',
    confirmed_at: now.toISOString(),
    compliance_snapshot: JSON.stringify(snapshot),
    conversation_id: conversationId,
    updated_at: now,
  }).where(eq(deployments.id, id)).returning();

  return c.json({ deployment: updated[0], conversation_id: conversationId, snapshot });
});

route.patch('/:id', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (['proposed', 'confirmed', 'active', 'completed', 'cancelled'].includes(String(body.status))) {
    patch.status = body.status;
  }
  if ('notes' in body) patch.notes = str(body.notes);
  if (Object.keys(patch).length === 0) return c.json({ error: 'nothing_to_update' }, 400);
  const updated = await db.update(deployments).set({ ...patch, updated_at: new Date() }).where(eq(deployments.id, c.req.param('id'))).returning();
  if (!updated[0]) return c.json({ error: 'not_found' }, 404);
  return c.json({ deployment: updated[0] });
});

export default route;
