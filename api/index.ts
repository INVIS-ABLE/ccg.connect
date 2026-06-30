import { Hono, type Context } from 'hono';
import { createAuth } from './auth';
import { verifyTurnstile } from './lib/integrations/turnstile';
import type { AppEnv } from './env';
import meRoutes from './routes/me';
import jobRoutes from './routes/jobs';
import profileRoutes from './routes/profiles';
import onboardingRoutes from './routes/onboarding';
import assignmentRoutes from './routes/assignments';
import leadRoutes from './routes/leads';
import contractorRoutes from './routes/contractors';
import clientRoutes from './routes/clients';
import matchRoutes from './routes/match';
import timesheetRoutes from './routes/timesheets';
import invoiceRoutes from './routes/invoices';
import quoteRoutes from './routes/quotes';
import checkinRoutes from './routes/checkins';
import notificationRoutes from './routes/notifications';
import mediaRoutes from './routes/media';
import credentialRoutes from './routes/credentials';
import messageRoutes from './routes/messages';
import signatureRoutes from './routes/signatures';
import adminPromotionRoutes from './routes/adminPromotion';
import adminBootstrapRoutes from './routes/adminBootstrap';
import { runCredentialExpiryJob } from './jobs/credentialExpiry';
import type { Bindings } from './env';

// Durable Object class must be exported from the Worker entry for wrangler.
export { ConversationRoom } from './chat/ConversationRoom';

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

// Bot protection (optional): when TURNSTILE_SECRET_KEY is set, sign-up and
// sign-in require a valid Turnstile token (sent by the client as a header). No
// secret → no-op, so auth is unaffected until you enable it.
const turnstileGuard = async (c: Context<AppEnv>, next: () => Promise<void>) => {
  const secret = c.env.TURNSTILE_SECRET_KEY;
  if (secret) {
    const token = c.req.header('x-turnstile-token');
    const ok = await verifyTurnstile(secret, token, c.req.header('cf-connecting-ip') ?? undefined);
    if (!ok) return c.json({ error: 'turnstile_failed' }, 403);
  }
  await next();
};
app.use('/api/auth/sign-up/email', turnstileGuard);
app.use('/api/auth/sign-in/email', turnstileGuard);

// Better Auth handles all of /api/auth/*.
app.on(['GET', 'POST'], '/api/auth/*', (c) => createAuth(c.env).handler(c.req.raw));

// Native, authorized resource routes.
app.route('/api/me', meRoutes);
app.route('/api/jobs', jobRoutes);
app.route('/api/profiles', profileRoutes);
app.route('/api/onboarding', onboardingRoutes);
app.route('/api/assignments', assignmentRoutes);
app.route('/api/leads', leadRoutes);
app.route('/api/contractors', contractorRoutes);
app.route('/api/clients', clientRoutes);
app.route('/api/match', matchRoutes);
app.route('/api/timesheets', timesheetRoutes);
app.route('/api/invoices', invoiceRoutes);
app.route('/api/quotes', quoteRoutes);
app.route('/api/checkins', checkinRoutes);
app.route('/api/notifications', notificationRoutes);
app.route('/api/media', mediaRoutes);
app.route('/api/credentials', credentialRoutes);
app.route('/api/messages', messageRoutes);
app.route('/api/signatures', signatureRoutes);
// Registered before the admin promotion routes so the unauthenticated, one-time
// bootstrap is not caught by their requireAuth middleware (it has its own gate).
app.route('/api/admin/bootstrap', adminBootstrapRoutes);
app.route('/api/admin', adminPromotionRoutes);

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