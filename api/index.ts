import { Hono } from 'hono';
import { createAuth } from './auth';
import type { AppEnv } from './env';
import meRoutes from './routes/me';
import jobRoutes from './routes/jobs';
import profileRoutes from './routes/profiles';
import assignmentRoutes from './routes/assignments';
import leadRoutes from './routes/leads';
import contractorRoutes from './routes/contractors';
import matchRoutes from './routes/match';
import timesheetRoutes from './routes/timesheets';
import invoiceRoutes from './routes/invoices';
import notificationRoutes from './routes/notifications';
import { runCredentialExpiryJob } from './jobs/credentialExpiry';
import type { Bindings } from './env';

/**
 * CCG Connect Worker (Hono) — Cloudflare-native backend.
 *
 * Base44 has been fully removed: there is no proxy and no external backend. All
 * data, auth and logic live here (D1 + Better Auth + these routes), with
 * authorization enforced server-side (src/domain/permissions).
 *
 *   /api/auth/*   → Better Auth (sign-in/up, OTP, OAuth, session)
 *   /api/me, /api/jobs, /api/profiles, /api/assignments → native, authorized
 *   /api/health   → liveness
 *   /api/*        → 404 (routes are built out slice by slice)
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
app.route('/api/leads', leadRoutes);
app.route('/api/contractors', contractorRoutes);
app.route('/api/match', matchRoutes);
app.route('/api/timesheets', timesheetRoutes);
app.route('/api/invoices', invoiceRoutes);
app.route('/api/notifications', notificationRoutes);

// Unknown API routes are genuine 404s — no Base44 fallback any more.
app.all('/api/*', (c) => c.json({ error: 'not_found' }, 404));

// Static assets + SPA fallback (handled by the assets binding's not_found_handling).
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

// Worker entry: HTTP via Hono + a scheduled (cron) handler for background jobs.
export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, env: Bindings, ctx: ExecutionContext) {
    ctx.waitUntil(runCredentialExpiryJob(env));
  },
};
