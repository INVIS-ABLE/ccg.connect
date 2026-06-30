import { Hono, type Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, desc } from 'drizzle-orm';
import { workers, workerCards } from '../db/schema';
import { requireAuth } from '../lib/session';
import { isAdmin } from '../../src/domain/permissions/permissions';
import type { AppEnv } from '../env';

/**
 * Individual workers (operatives) + their cards/qualifications — the worker
 * passport. Internal, admin-only. Distinct from contractor *companies*; sensitive
 * payroll/identity data (NI/UTR/bank) is intentionally not handled here.
 */
const route = new Hono<AppEnv>();
route.use('*', requireAuth);

const admin = (c: Context<AppEnv>) => isAdmin(c.get('principal'));
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
function pick(body: Record<string, unknown>, fields: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) if (f in body && body[f] !== undefined) out[f] = body[f] === '' ? null : body[f];
  return out;
}

const WORKER_FIELDS = [
  'full_name', 'mobile', 'email', 'home_address', 'base_postcode', 'emergency_contact_name',
  'emergency_contact_phone', 'right_to_work_status', 'rtw_check_date', 'rtw_checked_by',
  'rtw_expiry', 'payment_model', 'primary_trade', 'additional_skills', 'driving_licence',
  'plant_tickets', 'contractor_id', 'status', 'notes',
] as const;
const NUMERIC = ['experience_years', 'preferred_travel_miles', 'day_rate', 'hourly_rate'] as const;

function workerValues(body: Record<string, unknown>) {
  const out = pick(body, WORKER_FIELDS);
  for (const f of NUMERIC) if (f in body && body[f] !== undefined) out[f] = num(body[f]);
  return out;
}

route.get('/', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const contractorId = c.req.query('contractor_id');
  const rows = contractorId
    ? await db.select().from(workers).where(eq(workers.contractor_id, contractorId)).all()
    : await db.select().from(workers).orderBy(desc(workers.created_at)).all();
  return c.json({ workers: rows });
});

route.get('/:id', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const w = (await db.select().from(workers).where(eq(workers.id, c.req.param('id'))).limit(1))[0];
  if (!w) return c.json({ error: 'not_found' }, 404);
  return c.json({ worker: w });
});

route.post('/', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!str(body.full_name)) return c.json({ error: 'full_name_required' }, 400);
  const db = drizzle(c.env.DB);
  const inserted = await db.insert(workers).values(workerValues(body) as { full_name: string }).returning();
  return c.json({ worker: inserted[0] }, 201);
});

route.patch('/:id', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch = workerValues(body);
  if (Object.keys(patch).length === 0) return c.json({ error: 'nothing_to_update' }, 400);
  const db = drizzle(c.env.DB);
  const updated = await db.update(workers).set({ ...patch, updated_at: new Date() }).where(eq(workers.id, c.req.param('id'))).returning();
  if (!updated[0]) return c.json({ error: 'not_found' }, 404);
  return c.json({ worker: updated[0] });
});

// ── Cards / qualifications ───────────────────────────────────────────────────
const CARD_FIELDS = ['card_type', 'reference', 'issuer', 'issue_date', 'expiry_date', 'verification_status', 'file_url', 'notes'] as const;

route.get('/:id/cards', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const rows = await db.select().from(workerCards).where(eq(workerCards.worker_id, c.req.param('id'))).all();
  return c.json({ cards: rows });
});

route.post('/:id/cards', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const workerId = c.req.param('id');
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!str(body.card_type)) return c.json({ error: 'card_type_required' }, 400);
  const db = drizzle(c.env.DB);
  const inserted = await db.insert(workerCards).values({
    ...(pick(body, CARD_FIELDS) as { card_type: string }),
    worker_id: workerId,
  }).returning();
  return c.json({ card: inserted[0] }, 201);
});

route.patch('/:id/cards/:cardId', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch = pick(body, CARD_FIELDS);
  if (Object.keys(patch).length === 0) return c.json({ error: 'nothing_to_update' }, 400);
  const db = drizzle(c.env.DB);
  const updated = await db.update(workerCards).set({ ...patch, updated_at: new Date() }).where(eq(workerCards.id, c.req.param('cardId'))).returning();
  if (!updated[0]) return c.json({ error: 'not_found' }, 404);
  return c.json({ card: updated[0] });
});

export default route;
