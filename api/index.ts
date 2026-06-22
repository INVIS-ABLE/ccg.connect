import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './db/schema';

/**
 * CCG Connect API (Cloudflare Worker, Hono) — migration off Base44.
 *
 * Phase 0 scaffolding: proves the Hono + D1 + Drizzle wiring. Real entity routes
 * and the server-side authorization layer (the 13 security invariants) land in
 * Phase 3 — see docs/migration-to-cloudflare.md. This module is NOT yet wired
 * into the deployed Worker (worker/index.js still proxies /api/* to Base44).
 */
export type Bindings = {
  DB: D1Database;
  BASE44_APP_BASE_URL?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get('/api/health', (c) => c.json({ ok: true, service: 'ccg-connect-api' }));

// Smoke test for the D1 + Drizzle binding (no auth; removed once real routes land).
app.get('/api/_db-check', async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const rows = await db.select().from(schema.skills).limit(1);
  return c.json({ ok: true, sample: rows });
});

export default app;
