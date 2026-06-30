import { Hono, type Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, inArray, desc } from 'drizzle-orm';
import { gangs, gangMembers, workers, workerCards } from '../db/schema';
import { requireAuth } from '../lib/session';
import { isAdmin } from '../../src/domain/permissions/permissions';
import type { AppEnv } from '../env';

/**
 * Gangs: reusable worker groupings under a gang leader. Admin-only. A gang is an
 * operational convenience, never a compliance shortcut — members are still
 * checked individually (see the compliance matrix).
 */
const route = new Hono<AppEnv>();
route.use('*', requireAuth);

const admin = (c: Context<AppEnv>) => isAdmin(c.get('principal'));
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

route.get('/', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const rows = await db.select().from(gangs).orderBy(desc(gangs.created_at)).all();
  return c.json({ gangs: rows });
});

route.get('/:id', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const gang = (await db.select().from(gangs).where(eq(gangs.id, c.req.param('id'))).limit(1))[0];
  if (!gang) return c.json({ error: 'not_found' }, 404);

  // Members joined to their worker passport (with cards) for the compliance view.
  const members = await db.select().from(gangMembers).where(eq(gangMembers.gang_id, gang.id)).all();
  const workerIds = members.map((m) => m.worker_id);
  const workerRows = workerIds.length
    ? await db.select().from(workers).where(inArray(workers.id, workerIds)).all()
    : [];
  const byId = new Map(workerRows.map((w) => [w.id, w]));
  // Cards for all members, grouped per worker (for the compliance matrix).
  const cardRows = workerIds.length
    ? await db.select().from(workerCards).where(inArray(workerCards.worker_id, workerIds)).all()
    : [];
  const cardsByWorker = new Map<string, typeof cardRows>();
  for (const cd of cardRows) {
    const arr = cardsByWorker.get(cd.worker_id) ?? [];
    arr.push(cd);
    cardsByWorker.set(cd.worker_id, arr);
  }
  const memberOut = members.map((m) => {
    const w = byId.get(m.worker_id) ?? null;
    return {
      id: m.id,
      worker_id: m.worker_id,
      role: m.role,
      worker: w ? { ...w, cards: cardsByWorker.get(m.worker_id) ?? [] } : null,
    };
  });
  return c.json({ gang, members: memberOut });
});

route.post('/', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!str(body.name)) return c.json({ error: 'name_required' }, 400);
  const db = drizzle(c.env.DB);
  const inserted = await db.insert(gangs).values({
    name: str(body.name) as string,
    gang_leader_worker_id: str(body.gang_leader_worker_id),
    base_postcode: str(body.base_postcode),
    service_radius_miles: num(body.service_radius_miles),
    usual_day_rate: num(body.usual_day_rate),
    vehicles: str(body.vehicles),
    plant_capability: str(body.plant_capability),
    notes: str(body.notes),
  }).returning();
  return c.json({ gang: inserted[0] }, 201);
});

route.patch('/:id', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const f of ['name', 'gang_leader_worker_id', 'base_postcode', 'vehicles', 'plant_capability', 'notes', 'status']) {
    if (f in body && body[f] !== undefined) patch[f] = body[f] === '' ? null : body[f];
  }
  for (const f of ['service_radius_miles', 'usual_day_rate']) if (f in body) patch[f] = num(body[f]);
  if (Object.keys(patch).length === 0) return c.json({ error: 'nothing_to_update' }, 400);
  const db = drizzle(c.env.DB);
  const updated = await db.update(gangs).set({ ...patch, updated_at: new Date() }).where(eq(gangs.id, c.req.param('id'))).returning();
  if (!updated[0]) return c.json({ error: 'not_found' }, 404);
  return c.json({ gang: updated[0] });
});

// ── Members ──────────────────────────────────────────────────────────────────
route.post('/:id/members', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const gangId = c.req.param('id');
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const workerId = str(body.worker_id);
  if (!workerId) return c.json({ error: 'worker_id_required' }, 400);
  const role = ['leader', 'permanent', 'reserve'].includes(String(body.role))
    ? (body.role as 'leader' | 'permanent' | 'reserve')
    : 'permanent';
  const db = drizzle(c.env.DB);
  // The unique (gang, worker) index guards against duplicates.
  try {
    const inserted = await db.insert(gangMembers).values({ gang_id: gangId, worker_id: workerId, role }).returning();
    return c.json({ member: inserted[0] }, 201);
  } catch {
    return c.json({ error: 'already_member' }, 409);
  }
});

route.delete('/:id/members/:memberId', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  await db.delete(gangMembers).where(eq(gangMembers.id, c.req.param('memberId')));
  return c.json({ ok: true });
});

export default route;
