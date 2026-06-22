import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { userProfiles } from '../db/schema';
import { requireAuth } from '../lib/session';
import type { AppEnv } from '../env';

const route = new Hono<AppEnv>();
route.use('*', requireAuth);

// GET /api/me — the current caller: principal (role + scope) and their profile.
route.get('/', async (c) => {
  const p = c.get('principal');
  const db = drizzle(c.env.DB);
  const rows = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.user_id, p.userId))
    .limit(1);
  return c.json({ principal: p, profile: rows[0] ?? null });
});

export default route;
