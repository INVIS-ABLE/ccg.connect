import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { and, eq, desc } from 'drizzle-orm';
import { notifications } from '../db/schema';
import { requireAuth } from '../lib/session';
import type { AppEnv } from '../env';

const route = new Hono<AppEnv>();
route.use('*', requireAuth);

// GET /api/notifications — the caller's own notifications, newest first.
route.get('/', async (c) => {
  const p = c.get('principal');
  const db = drizzle(c.env.DB);
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.user_id, p.userId))
    .orderBy(desc(notifications.created_at))
    .limit(100);
  return c.json({ notifications: rows });
});

// PATCH /api/notifications/:id — mark one of your own notifications read.
route.patch('/:id', async (c) => {
  const p = c.get('principal');
  const db = drizzle(c.env.DB);
  const updated = await db
    .update(notifications)
    .set({ read_at: new Date().toISOString() })
    .where(and(eq(notifications.id, c.req.param('id')), eq(notifications.user_id, p.userId)))
    .returning();
  if (!updated[0]) return c.json({ error: 'not_found' }, 404);
  return c.json({ notification: updated[0] });
});

export default route;
