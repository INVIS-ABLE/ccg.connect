import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { userProfiles } from '../db/schema';
import { requireAuth } from '../lib/session';
import { isAdminRole } from '../../src/domain/auth/roles';
import type { AppEnv } from '../env';

const route = new Hono<AppEnv>();
route.use('*', requireAuth);

/**
 * GET /api/admin/users — list all user profiles (admins only)
 */
route.get('/users', async (c) => {
  const p = c.get('principal');
  if (!isAdminRole(p.role)) return c.json({ error: 'Forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const rows = await db.select().from(userProfiles).all();
  return c.json(rows);
});

/**
 * PATCH /api/admin/users/:id/role — promote/demote a user (admins only)
 */
route.patch('/users/:id/role', async (c) => {
  const p = c.get('principal');
  if (!isAdminRole(p.role)) return c.json({ error: 'Forbidden' }, 403);

  const { id } = c.req.param();
  const body = await c.req.json<{ role: string }>();
  const allowed = ['owner', 'ops_admin', 'contractor', 'client'];
  if (!allowed.includes(body.role)) {
    return c.json({ error: 'Invalid role' }, 400);
  }

  const db = drizzle(c.env.DB);
  await db
    .update(userProfiles)
    .set({ role: body.role as 'owner' | 'ops_admin' | 'contractor' | 'client', updated_at: new Date() })
    .where(eq(userProfiles.id, id));

  const updated = await db.select().from(userProfiles).where(eq(userProfiles.id, id)).limit(1);
  return c.json(updated[0] ?? null);
});

export default route;