import { Hono, type Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, desc } from 'drizzle-orm';
import { labourRequests } from '../db/schema';
import { requireAuth } from '../lib/session';
import { isAdmin } from '../../src/domain/permissions/permissions';
import {
  isLabourRequestStatus,
  canTransition,
  type LabourRequestStatus,
} from '../../src/domain/commercial/labourRequestStatus';
import type { AppEnv } from '../env';

/**
 * Labour requests — corporate clients' structured worker orders. Admin-only for
 * now (the commercial team raises/manages them); a client-portal surface comes
 * later. Status moves are validated against the pure transition rules.
 */
const route = new Hono<AppEnv>();
route.use('*', requireAuth);

const admin = (c: Context<AppEnv>) => isAdmin(c.get('principal'));
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

const TEXT_FIELDS = [
  'project_id', 'site_id', 'title', 'request_type', 'work_package', 'trade', 'gang_composition',
  'start_date', 'finish_date', 'shift_pattern', 'minimum_qualifications',
  'experience_required', 'employment_model', 'travel_lodge_allowance', 'po_number',
  'urgency', 'replacement_sla', 'notes',
] as const;
const NUM_FIELDS = ['rate_offered', 'charge_rate', 'overtime_rate'] as const;

function values(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const f of TEXT_FIELDS) if (f in body && body[f] !== undefined) out[f] = body[f] === '' ? null : body[f];
  for (const f of NUM_FIELDS) if (f in body && body[f] !== undefined) out[f] = num(body[f]);
  if (body.number_required !== undefined) out.number_required = num(body.number_required) ?? 1;
  return out;
}

route.get('/', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const accountId = c.req.query('account_id');
  const rows = accountId
    ? await db.select().from(labourRequests).where(eq(labourRequests.account_id, accountId)).all()
    : await db.select().from(labourRequests).orderBy(desc(labourRequests.created_at)).all();
  return c.json({ requests: rows });
});

route.get('/:id', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const r = (await db.select().from(labourRequests).where(eq(labourRequests.id, c.req.param('id'))).limit(1))[0];
  if (!r) return c.json({ error: 'not_found' }, 404);
  return c.json({ request: r });
});

route.post('/', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const me = c.get('principal');
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!str(body.account_id)) return c.json({ error: 'account_id_required' }, 400);
  if (!str(body.title)) return c.json({ error: 'title_required' }, 400);
  const db = drizzle(c.env.DB);
  const inserted = await db.insert(labourRequests).values({
    ...(values(body) as { title: string }),
    account_id: str(body.account_id) as string,
    created_by: me.userId,
  }).returning();
  return c.json({ request: inserted[0] }, 201);
});

route.patch('/:id', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const id = c.req.param('id');
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;

  const current = (await db.select().from(labourRequests).where(eq(labourRequests.id, id)).limit(1))[0];
  if (!current) return c.json({ error: 'not_found' }, 404);

  const patch = values(body);
  // Status changes are validated against the transition rules.
  if (body.status !== undefined) {
    if (!isLabourRequestStatus(body.status)) return c.json({ error: 'invalid_status' }, 400);
    if (body.status !== current.status && !canTransition(current.status as LabourRequestStatus, body.status)) {
      return c.json({ error: 'illegal_transition' }, 400);
    }
    patch.status = body.status;
  }
  if (Object.keys(patch).length === 0) return c.json({ error: 'nothing_to_update' }, 400);

  const updated = await db.update(labourRequests).set({ ...patch, updated_at: new Date() }).where(eq(labourRequests.id, id)).returning();
  return c.json({ request: updated[0] });
});

export default route;
