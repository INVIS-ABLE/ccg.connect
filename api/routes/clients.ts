import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, desc } from 'drizzle-orm';
import { clients } from '../db/schema';
import { requireAuth } from '../lib/session';
import { isAdmin, type Principal } from '../../src/domain/permissions/permissions';
import type { AppEnv } from '../env';

/**
 * Client organisations. Admin-managed; a client user may read only their own org
 * (invariant 2). private_admin_notes is stripped for non-admins (invariant 6).
 */
const route = new Hono<AppEnv>();
route.use('*', requireAuth);

type ClientInsert = typeof clients.$inferInsert;
type ClientRow = typeof clients.$inferSelect;

const WRITABLE: (keyof ClientInsert)[] = [
  'client_reference', 'client_type', 'individual_or_company_name', 'main_contact_name', 'email',
  'phone', 'billing_email', 'billing_address', 'default_site_address', 'default_postcode',
  'account_status', 'portal_enabled',
];

function pick(body: Record<string, unknown>, keys: (keyof ClientInsert)[]): Partial<ClientInsert> {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (k in body && body[k as string] !== undefined) out[k as string] = body[k as string];
  return out as Partial<ClientInsert>;
}

/** Strip admin-only fields for non-admins (invariant 6). */
function publicShape(p: Principal, row: ClientRow): Partial<ClientRow> {
  if (isAdmin(p)) return row;
  const { private_admin_notes: _notes, ...rest } = row;
  return rest;
}

// GET /api/clients — admins see all; a client user sees only their own org.
route.get('/', async (c) => {
  const p = c.get('principal');
  const db = drizzle(c.env.DB);
  if (isAdmin(p)) {
    const rows = await db
      .select()
      .from(clients)
      .where(eq(clients.archived, false))
      .orderBy(desc(clients.created_at))
      .limit(500);
    return c.json({ clients: rows });
  }
  if (p.role === 'client' && p.clientId) {
    const rows = await db.select().from(clients).where(eq(clients.id, p.clientId)).limit(1);
    return c.json({ clients: rows.map((r) => publicShape(p, r)) });
  }
  return c.json({ clients: [] });
});

// GET /api/clients/:id — admin, or the owning client user.
route.get('/:id', async (c) => {
  const p = c.get('principal');
  const db = drizzle(c.env.DB);
  const rows = await db.select().from(clients).where(eq(clients.id, c.req.param('id'))).limit(1);
  const cl = rows[0];
  if (!cl) return c.json({ error: 'not_found' }, 404);
  if (!isAdmin(p) && p.clientId !== cl.id) return c.json({ error: 'forbidden' }, 403);
  return c.json({ client: publicShape(p, cl) });
});

// POST /api/clients — create a client org (admin only).
route.post('/', async (c) => {
  const p = c.get('principal');
  if (!isAdmin(p)) return c.json({ error: 'forbidden' }, 403);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof body.individual_or_company_name !== 'string' || !body.individual_or_company_name.trim()) {
    return c.json({ error: 'name_required' }, 400);
  }
  const db = drizzle(c.env.DB);
  const inserted = await db.insert(clients).values(pick(body, WRITABLE) as ClientInsert).returning();
  return c.json({ client: inserted[0] }, 201);
});

// PATCH /api/clients/:id — update (admin only).
route.patch('/:id', async (c) => {
  const p = c.get('principal');
  if (!isAdmin(p)) return c.json({ error: 'forbidden' }, 403);
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return c.json({ error: 'invalid_body' }, 400);
  const db = drizzle(c.env.DB);
  const updated = await db
    .update(clients)
    .set(pick(body, [...WRITABLE, 'private_admin_notes', 'archived']))
    .where(eq(clients.id, c.req.param('id')))
    .returning();
  if (!updated[0]) return c.json({ error: 'not_found' }, 404);
  return c.json({ client: updated[0] });
});

export default route;
