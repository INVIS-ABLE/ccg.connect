import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { createAuth } from '../auth';
import { userProfiles, auditEvents } from '../db/schema';
import { user as authUser } from '../db/auth-schema';
import type { AppEnv } from '../env';

/**
 * One-time bootstrap of the very first `owner` admin.
 *
 * Why this exists: every privileged operation is admin-gated (see
 * routes/adminPromotion.ts), which creates a chicken-and-egg problem — there is
 * no admin to promote the first admin. This endpoint resolves it without ever
 * committing a credential to the repository (CLAUDE.md invariant 10).
 *
 * Security posture:
 *   - DISABLED unless `ADMIN_BOOTSTRAP_SECRET` is configured for the deploy
 *     (set transiently via `wrangler secret put`, then deleted). No secret →
 *     the route 404s as if it does not exist.
 *   - Caller must present that secret in the `x-bootstrap-secret` header.
 *   - SELF-DISABLING: refuses once any `owner` profile exists, so it can only
 *     mint the first admin and cannot be replayed to create more.
 *   - The password is supplied in the request body and hashed by Better Auth
 *     (`signUpEmail`); it is never logged, returned, or stored in plaintext.
 *   - The action is audited (invariant 11) with the password omitted.
 */
const route = new Hono<AppEnv>();

route.post('/', async (c) => {
  const secret = c.env.ADMIN_BOOTSTRAP_SECRET;
  // No bootstrap secret configured → behave as if the route does not exist.
  if (!secret) return c.json({ error: 'not_found' }, 404);

  const provided = c.req.header('x-bootstrap-secret');
  if (!provided || provided !== secret) return c.json({ error: 'forbidden' }, 403);

  const body = (await c.req.json().catch(() => null)) as
    | { email?: string; password?: string; name?: string }
    | null;
  const email = body?.email?.trim().toLowerCase();
  const password = body?.password;
  const name = body?.name?.trim() || 'Administrator';
  if (!email || !password) return c.json({ error: 'email_and_password_required' }, 400);
  if (password.length < 8) return c.json({ error: 'weak_password' }, 400);

  const db = drizzle(c.env.DB);

  // One-shot: never run once an owner exists.
  const existingOwner = await db
    .select({ id: userProfiles.id })
    .from(userProfiles)
    .where(eq(userProfiles.role, 'owner'))
    .limit(1);
  if (existingOwner[0]) return c.json({ error: 'already_initialised' }, 409);

  // Create the Better Auth user (password hashed), or reuse one that already
  // signed up with this email.
  let userId: string;
  const found = await db
    .select({ id: authUser.id })
    .from(authUser)
    .where(eq(authUser.email, email))
    .limit(1);
  if (found[0]) {
    userId = found[0].id;
  } else {
    const auth = createAuth(c.env);
    const created = await auth.api.signUpEmail({ body: { email, password, name } });
    userId = created.user.id;
  }

  // Upsert the profile as an active owner.
  const profileRow = await db
    .select({ id: userProfiles.id })
    .from(userProfiles)
    .where(eq(userProfiles.user_id, userId))
    .limit(1);
  if (profileRow[0]) {
    await db
      .update(userProfiles)
      .set({ role: 'owner', account_status: 'active', email, updated_at: new Date() })
      .where(eq(userProfiles.user_id, userId));
  } else {
    await db
      .insert(userProfiles)
      .values({ user_id: userId, role: 'owner', account_status: 'active', email });
  }

  // Audit the bootstrap (invariant 11) — never record the password.
  await db.insert(auditEvents).values({
    actor_user_id: null,
    action: 'admin.bootstrap',
    entity_type: 'user_profile',
    entity_id: userId,
    new_values: JSON.stringify({ role: 'owner', email, account_status: 'active' }),
    timestamp: new Date().toISOString(),
    reason: 'Initial owner admin bootstrap',
  });

  return c.json({ ok: true, user_id: userId, email, role: 'owner' });
});

export default route;
