import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './db/schema';
import { createAuth, type AuthEnv } from './auth';

/**
 * CCG Connect Worker (Hono) — Cloudflare-native backend, migrating off Base44.
 *
 * Strangler facade: new endpoints are served here; everything not yet migrated
 * falls through to the Base44 proxy, so the app keeps working unchanged while we
 * move functionality across one slice at a time.
 *
 *   /api/auth/*  → Better Auth (new; the front-end does not call this yet)
 *   /api/health  → liveness
 *   /api/*       → proxied to the Base44 backend (current behaviour)
 *   everything else → static assets + SPA fallback (ASSETS binding)
 */
export type Bindings = AuthEnv & {
  ASSETS: Fetcher;
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

// Better Auth handles all of /api/auth/* (sign-in/up, OTP, OAuth, session).
app.on(['GET', 'POST'], '/api/auth/*', (c) => createAuth(c.env).handler(c.req.raw));

// Strangler fallback: anything under /api not handled above still goes to Base44.
app.all('/api/*', (c) => proxyToBase44(c.req.raw, c.env));

// Static assets + SPA fallback (handled by the assets binding's not_found_handling).
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

async function proxyToBase44(request: Request, env: Bindings): Promise<Response> {
  const base = env.BASE44_APP_BASE_URL;
  if (!base) {
    return new Response(
      JSON.stringify({ error: 'BASE44_APP_BASE_URL is not configured for this Worker.' }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    );
  }

  const url = new URL(request.url);
  const target = base.replace(/\/+$/, '') + url.pathname + url.search;

  // Preserve method, headers and body; drop the inbound Host so fetch sets it from
  // the target. `duplex: 'half'` is required when streaming a request body.
  const headers = new Headers(request.headers);
  headers.delete('host');

  const init: RequestInit = {
    method: request.method,
    headers,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    redirect: 'manual',
  };
  (init as RequestInit & { duplex: 'half' }).duplex = 'half';

  return fetch(target, init);
}

export default app;
