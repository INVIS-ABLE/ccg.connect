import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, desc } from 'drizzle-orm';
import { contractorProfiles } from '../db/schema';
import { requireAuth } from '../lib/session';
import {
  isAdmin,
  canManageContractors,
  canReadContractor,
  canWriteContractor,
  redactForRole,
  INTERNAL_PROFILE_FIELDS,
} from '../../src/domain/permissions/permissions';
import type { AppEnv } from '../env';

const route = new Hono<AppEnv>();
route.use('*', requireAuth);

type ContractorInsert = typeof contractorProfiles.$inferInsert;

// Fields a contractor may edit on their own profile.
const CONTRACTOR_WRITABLE: (keyof ContractorInsert)[] = [
  'trading_name', 'legal_name', 'company_number', 'tax_or_vat_reference', 'primary_trade',
  'biography', 'base_postcode', 'postcode_district', 'service_radius_miles',
  'maximum_travel_miles', 'transport_available', 'day_rate', 'hourly_rate',
  'availability_status',
];
// Fields only an admin may set (approval, risk, internal notes).
const ADMIN_WRITABLE: (keyof ContractorInsert)[] = [
  'approval_status', 'preferred_contractor', 'internal_risk_status', 'private_admin_notes',
  'suspended_reason', 'onboarding_completed', 'approved_by', 'approved_at',
];

function pick(body: Record<string, unknown>, keys: (keyof ContractorInsert)[]): Partial<ContractorInsert> {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (k in body && body[k as string] !== undefined) out[k as string] = body[k as string];
  return out as Partial<ContractorInsert>;
}

// GET /api/contractors — admins see all; a contractor sees only their own.
route.get('/', async (c) => {
  const p = c.get('principal');
  const db = drizzle(c.env.DB);
  if (isAdmin(p)) {
    const rows = await db
      .select()
      .from(contractorProfiles)
      .orderBy(desc(contractorProfiles.created_at))
      .limit(500);
    return c.json({ contractors: rows });
  }
  const rows = await db
    .select()
    .from(contractorProfiles)
    .where(eq(contractorProfiles.user_id, p.userId))
    .limit(1);
  return c.json({ contractors: rows.map((r) => redactForRole(p, r, INTERNAL_PROFILE_FIELDS)) });
});

// GET /api/contractors/:id
route.get('/:id', async (c) => {
  const p = c.get('principal');
  const db = drizzle(c.env.DB);
  const rows = await db
    .select()
    .from(contractorProfiles)
    .where(eq(contractorProfiles.id, c.req.param('id')))
    .limit(1);
  const profile = rows[0];
  if (!profile) return c.json({ error: 'not_found' }, 404);
  if (!canReadContractor(p, profile)) return c.json({ error: 'forbidden' }, 403);
  return c.json({ contractor: redactForRole(p, profile, INTERNAL_PROFILE_FIELDS) });
});

// POST /api/contractors — self-onboard (own profile) or admin create.
route.post('/', async (c) => {
  const p = c.get('principal');
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const userId = isAdmin(p) && typeof body.user_id === 'string' ? body.user_id : p.userId;

  const db = drizzle(c.env.DB);
  const existing = await db
    .select({ id: contractorProfiles.id })
    .from(contractorProfiles)
    .where(eq(contractorProfiles.user_id, userId))
    .limit(1);
  if (existing[0]) return c.json({ error: 'profile_exists', id: existing[0].id }, 409);

  const values: ContractorInsert = {
    user_id: userId,
    approval_status: 'pending', // invariant: approval is an admin action, never self-set
    ...pick(body, CONTRACTOR_WRITABLE),
    ...(isAdmin(p) ? pick(body, ADMIN_WRITABLE) : {}),
  };
  const inserted = await db.insert(contractorProfiles).values(values).returning();
  return c.json({ contractor: inserted[0] }, 201);
});

// PATCH /api/contractors/:id — contractor edits own non-privileged fields; admins
// may also approve/suspend/risk-rate.
route.patch('/:id', async (c) => {
  const p = c.get('principal');
  const db = drizzle(c.env.DB);
  const rows = await db
    .select()
    .from(contractorProfiles)
    .where(eq(contractorProfiles.id, c.req.param('id')))
    .limit(1);
  const profile = rows[0];
  if (!profile) return c.json({ error: 'not_found' }, 404);
  if (!canWriteContractor(p, profile)) return c.json({ error: 'forbidden' }, 403);

  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return c.json({ error: 'invalid_body' }, 400);

  const updates = pick(body, CONTRACTOR_WRITABLE);
  if (canManageContractors(p)) Object.assign(updates, pick(body, ADMIN_WRITABLE));

  const updated = await db
    .update(contractorProfiles)
    .set(updates)
    .where(eq(contractorProfiles.id, profile.id))
    .returning();
  return c.json({ contractor: redactForRole(p, updated[0]!, INTERNAL_PROFILE_FIELDS) });
});

export default route;
