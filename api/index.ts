import { Hono } from 'hono';
import { createAuth } from './auth';
import type { AppEnv, Bindings } from './env';
import meRoutes from './routes/me';
import jobRoutes from './routes/jobs';
import profileRoutes from './routes/profiles';
import assignmentRoutes from './routes/assignments';

/**
 * CCG Connect Worker (Hono) — Cloudflare-native backend.
 *
 * As the app is rebuilt off Base44, native routes are served here and enforce
 * authorization server-side (src/domain/permissions). The Base44 proxy fallback
 * remains only until the front-end is fully rebuilt, then it is removed.
 *
 *   /api/auth/*   → Better Auth (sign-in/up, OTP, OAuth, session)
 *   /api/me, /api/jobs, /api/profiles, /api/assignments → native, authorized
 *   /api/health   → liveness
 *   /api/*        → (temporary) proxied to Base44 for anything not yet migrated
 *   everything else → static assets + SPA fallback
 */
const app = new Hono<AppEnv>();

app.get('/api/health', (c) => c.json({ ok: true, service: 'ccg-connect-api' }));

// Better Auth handles all of /api/auth/*.
app.on(['GET', 'POST'], '/api/auth/*', (c) => createAuth(c.env).handler(c.req.raw));

// Native, authorized resource routes.
app.route('/api/me', meRoutes);
app.route('/api/jobs', jobRoutes);
app.route('/api/profiles', profileRoutes);
app.route('/api/assignments', assignmentRoutes);

// Temporary strangler fallback: anything under /api not handled above → Base44.
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
