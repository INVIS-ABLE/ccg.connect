import { Hono, type Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, desc, and } from 'drizzle-orm';
import {
  corporateAccounts,
  corporateContacts,
  commercialProjects,
  commercialSites,
  corporateAccountUsers,
  userProfiles,
} from '../db/schema';
import { requireAuth } from '../lib/session';
import { isAdmin } from '../../src/domain/permissions/permissions';
import type { AppEnv } from '../env';

/**
 * Commercial / agency structure: corporate accounts → contacts, projects → sites.
 * Internal, admin-only (owner/ops_admin). This is the enterprise labour-supply
 * backbone, kept separate from the simple `clients` model.
 */
const route = new Hono<AppEnv>();
route.use('*', requireAuth);

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
function adminOnly(c: Context<AppEnv>) {
  return isAdmin(c.get('principal'));
}

// ── Corporate accounts ───────────────────────────────────────────────────────
route.get('/accounts', async (c) => {
  if (!adminOnly(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const rows = await db.select().from(corporateAccounts).orderBy(desc(corporateAccounts.created_at)).all();
  return c.json({ accounts: rows });
});

route.get('/accounts/:id', async (c) => {
  if (!adminOnly(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const a = (await db.select().from(corporateAccounts).where(eq(corporateAccounts.id, c.req.param('id'))).limit(1))[0];
  if (!a) return c.json({ error: 'not_found' }, 404);
  return c.json({ account: a });
});

const ACCOUNT_FIELDS = [
  'legal_name', 'trading_name', 'registration_number', 'status', 'vat_treatment',
  'cis_treatment', 'payment_terms', 'framework_agreement', 'insurance_requirements',
  'required_accreditations', 'invoice_instructions', 'supplier_portal_reference',
  'data_retention_note', 'notes',
] as const;

function pick(body: Record<string, unknown>, fields: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) if (f in body && body[f] !== undefined) out[f] = body[f] === '' ? null : body[f];
  return out;
}

route.post('/accounts', async (c) => {
  if (!adminOnly(c)) return c.json({ error: 'forbidden' }, 403);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!str(body.legal_name)) return c.json({ error: 'legal_name_required' }, 400);
  const db = drizzle(c.env.DB);
  const inserted = await db.insert(corporateAccounts).values(pick(body, ACCOUNT_FIELDS) as { legal_name: string }).returning();
  return c.json({ account: inserted[0] }, 201);
});

route.patch('/accounts/:id', async (c) => {
  if (!adminOnly(c)) return c.json({ error: 'forbidden' }, 403);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch = pick(body, ACCOUNT_FIELDS);
  if (Object.keys(patch).length === 0) return c.json({ error: 'nothing_to_update' }, 400);
  const db = drizzle(c.env.DB);
  const updated = await db.update(corporateAccounts).set({ ...patch, updated_at: new Date() }).where(eq(corporateAccounts.id, c.req.param('id'))).returning();
  if (!updated[0]) return c.json({ error: 'not_found' }, 404);
  return c.json({ account: updated[0] });
});

// ── Contacts ─────────────────────────────────────────────────────────────────
route.get('/contacts', async (c) => {
  if (!adminOnly(c)) return c.json({ error: 'forbidden' }, 403);
  const accountId = c.req.query('account_id');
  if (!accountId) return c.json({ error: 'account_id_required' }, 400);
  const db = drizzle(c.env.DB);
  const rows = await db.select().from(corporateContacts).where(eq(corporateContacts.account_id, accountId)).all();
  return c.json({ contacts: rows });
});

route.post('/contacts', async (c) => {
  if (!adminOnly(c)) return c.json({ error: 'forbidden' }, 403);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const accountId = str(body.account_id);
  const name = str(body.name);
  if (!accountId || !name) return c.json({ error: 'account_id_and_name_required' }, 400);
  const role = ['commercial', 'procurement', 'accounts', 'site', 'other'].includes(String(body.role))
    ? (body.role as 'commercial' | 'procurement' | 'accounts' | 'site' | 'other')
    : 'other';
  const db = drizzle(c.env.DB);
  const inserted = await db.insert(corporateContacts).values({
    account_id: accountId, name, role, email: str(body.email), phone: str(body.phone), notes: str(body.notes),
  }).returning();
  return c.json({ contact: inserted[0] }, 201);
});

// ── Projects ─────────────────────────────────────────────────────────────────
route.get('/projects', async (c) => {
  if (!adminOnly(c)) return c.json({ error: 'forbidden' }, 403);
  const accountId = c.req.query('account_id');
  const db = drizzle(c.env.DB);
  const rows = accountId
    ? await db.select().from(commercialProjects).where(eq(commercialProjects.account_id, accountId)).all()
    : await db.select().from(commercialProjects).orderBy(desc(commercialProjects.created_at)).all();
  return c.json({ projects: rows });
});

route.get('/projects/:id', async (c) => {
  if (!adminOnly(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const p = (await db.select().from(commercialProjects).where(eq(commercialProjects.id, c.req.param('id'))).limit(1))[0];
  if (!p) return c.json({ error: 'not_found' }, 404);
  return c.json({ project: p });
});

route.post('/projects', async (c) => {
  if (!adminOnly(c)) return c.json({ error: 'forbidden' }, 403);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const accountId = str(body.account_id);
  const name = str(body.name);
  if (!accountId || !name) return c.json({ error: 'account_id_and_name_required' }, 400);
  const status = ['active', 'on_hold', 'completed', 'cancelled'].includes(String(body.status))
    ? (body.status as 'active' | 'on_hold' | 'completed' | 'cancelled')
    : 'active';
  const db = drizzle(c.env.DB);
  const inserted = await db.insert(commercialProjects).values({
    account_id: accountId, name, status,
    project_number: str(body.project_number), region_division: str(body.region_division), notes: str(body.notes),
  }).returning();
  return c.json({ project: inserted[0] }, 201);
});

// ── Sites ────────────────────────────────────────────────────────────────────
const SITE_FIELDS = [
  'name', 'site_address', 'postcode', 'what3words', 'principal_contractor', 'site_manager',
  'commercial_manager', 'working_hours', 'parking_access', 'induction_instructions',
  'ppe_requirements', 'drug_alcohol_policy', 'emergency_arrangements', 'welfare_info',
  'site_rules', 'required_cards', 'prohibited_activities', 'check_in_method', 'po_number',
  'cost_code', 'status',
] as const;

route.get('/sites', async (c) => {
  if (!adminOnly(c)) return c.json({ error: 'forbidden' }, 403);
  const projectId = c.req.query('project_id');
  if (!projectId) return c.json({ error: 'project_id_required' }, 400);
  const db = drizzle(c.env.DB);
  const rows = await db.select().from(commercialSites).where(eq(commercialSites.project_id, projectId)).all();
  return c.json({ sites: rows });
});

route.get('/sites/:id', async (c) => {
  if (!adminOnly(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const s = (await db.select().from(commercialSites).where(eq(commercialSites.id, c.req.param('id'))).limit(1))[0];
  if (!s) return c.json({ error: 'not_found' }, 404);
  return c.json({ site: s });
});

route.post('/sites', async (c) => {
  if (!adminOnly(c)) return c.json({ error: 'forbidden' }, 403);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const projectId = str(body.project_id);
  const name = str(body.name);
  if (!projectId || !name) return c.json({ error: 'project_id_and_name_required' }, 400);
  const db = drizzle(c.env.DB);
  // Resolve the owning account from the project so site is scoped consistently.
  const proj = (await db.select({ account_id: commercialProjects.account_id }).from(commercialProjects).where(eq(commercialProjects.id, projectId)).limit(1))[0];
  if (!proj) return c.json({ error: 'project_not_found' }, 404);
  const inserted = await db.insert(commercialSites).values({
    ...(pick(body, SITE_FIELDS) as { name: string }),
    project_id: projectId,
    account_id: proj.account_id,
    latitude: num(body.latitude),
    longitude: num(body.longitude),
  }).returning();
  return c.json({ site: inserted[0] }, 201);
});

route.patch('/sites/:id', async (c) => {
  if (!adminOnly(c)) return c.json({ error: 'forbidden' }, 403);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch = pick(body, SITE_FIELDS);
  if (Object.keys(patch).length === 0) return c.json({ error: 'nothing_to_update' }, 400);
  const db = drizzle(c.env.DB);
  const updated = await db.update(commercialSites).set({ ...patch, updated_at: new Date() }).where(eq(commercialSites.id, c.req.param('id'))).returning();
  if (!updated[0]) return c.json({ error: 'not_found' }, 404);
  return c.json({ site: updated[0] });
});

// ── Portal access: link client logins to a corporate account ─────────────────
// Granting/revoking portal visibility is an admin action (invariants 2 & 5).
route.get('/accounts/:id/users', async (c) => {
  if (!adminOnly(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const links = await db.select().from(corporateAccountUsers).where(eq(corporateAccountUsers.account_id, c.req.param('id'))).all();
  return c.json({ users: links });
});

route.post('/accounts/:id/users', async (c) => {
  if (!adminOnly(c)) return c.json({ error: 'forbidden' }, 403);
  const me = c.get('principal');
  const db = drizzle(c.env.DB);
  const accountId = c.req.param('id');
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const userId = str(body.user_id);
  if (!userId) return c.json({ error: 'user_id_required' }, 400);

  const account = (await db.select({ id: corporateAccounts.id }).from(corporateAccounts).where(eq(corporateAccounts.id, accountId)).limit(1))[0];
  if (!account) return c.json({ error: 'account_not_found' }, 404);

  // Only an existing client-role login may be granted portal access — never a
  // staff/contractor account, and granting never changes the user's role.
  const profile = (await db.select({ role: userProfiles.role }).from(userProfiles).where(eq(userProfiles.user_id, userId)).limit(1))[0];
  if (!profile) return c.json({ error: 'user_not_found' }, 404);
  if (profile.role !== 'client') return c.json({ error: 'not_a_client_user' }, 400);

  const existing = (await db.select({ id: corporateAccountUsers.id }).from(corporateAccountUsers)
    .where(and(eq(corporateAccountUsers.account_id, accountId), eq(corporateAccountUsers.user_id, userId))).limit(1))[0];
  if (existing) return c.json({ link: existing }, 200);

  const inserted = await db.insert(corporateAccountUsers).values({ account_id: accountId, user_id: userId, granted_by: me.userId }).returning();
  return c.json({ link: inserted[0] }, 201);
});

route.delete('/accounts/:id/users/:userId', async (c) => {
  if (!adminOnly(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  await db.delete(corporateAccountUsers)
    .where(and(eq(corporateAccountUsers.account_id, c.req.param('id')), eq(corporateAccountUsers.user_id, c.req.param('userId'))));
  return c.json({ ok: true });
});

export default route;
