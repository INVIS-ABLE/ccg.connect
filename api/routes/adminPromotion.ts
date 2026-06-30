import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { createAuth } from '../auth';
import { userProfiles, auditEvents } from '../db/schema';
import { user as authUser } from '../db/auth-schema';
import { requireAuth } from '../lib/session';
import { isAdminRole } from '../../src/domain/auth/roles';
import { canAssignRole, canCreateStaff } from '../../src/domain/permissions/permissions';
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
 * POST /api/admin/users — create a staff (admin) login.
 *
 * This is the admin-only path the public onboarding flow deliberately refuses:
 * `owner`/`ops_admin` accounts may ONLY be minted here by an existing admin
 * (CLAUDE.md invariant 5 — no public self-promotion to a privileged role).
 *
 * Security posture:
 *   - Admin-gated (requireAuth + isAdminRole).
 *   - Restricted to staff roles only (`ops_admin` | `owner`); contractor/client
 *     accounts are created through public onboarding, not here.
 *   - Owner is the only role that may create another `owner` (least privilege).
 *   - Password is hashed by Better Auth (`signUpEmail`) — never logged or stored
 *     in plaintext, and never returned in the response.
 *   - Refuses to clobber an existing profile (409).
 *   - Audited (invariant 11) with the password omitted.
 */
route.post('/users', async (c) => {
  const p = c.get('principal');
  if (!isAdminRole(p.role)) return c.json({ error: 'Forbidden' }, 403);

  const body = (await c.req.json().catch(() => null)) as
    | { email?: string; password?: string; first_name?: string; last_name?: string; role?: string }
    | null;
  const email = body?.email?.trim().toLowerCase();
  const password = body?.password;
  const firstName = body?.first_name?.trim() || null;
  const lastName = body?.last_name?.trim() || null;
  const role = body?.role ?? 'ops_admin';

  if (!email || !password) return c.json({ error: 'email_and_password_required' }, 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return c.json({ error: 'invalid_email' }, 400);
  if (password.length < 8) return c.json({ error: 'weak_password' }, 400);
  // Only staff roles may be created here — never contractor/client.
  if (role !== 'ops_admin' && role !== 'owner') {
    return c.json({ error: 'invalid_role' }, 400);
  }
  // Least privilege: only an owner may mint another owner.
  if (!canCreateStaff(p, role)) {
    return c.json({ error: 'only_owner_can_create_owner' }, 403);
  }

  const db = drizzle(c.env.DB);
  const displayName = [firstName, lastName].filter(Boolean).join(' ') || null;

  // Resolve (or create) the Better Auth user for this email.
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
    const created = await auth.api.signUpEmail({
      body: { email, password, name: displayName || email },
    });
    userId = created.user.id;
  }

  // Never clobber an existing profile — staff creation is for brand-new logins.
  const existing = await db
    .select({ id: userProfiles.id })
    .from(userProfiles)
    .where(eq(userProfiles.user_id, userId))
    .limit(1);
  if (existing[0]) return c.json({ error: 'profile_exists' }, 409);

  // Admins skip the contractor/client onboarding wizard — mark active + onboarded.
  const now = new Date().toISOString();
  const inserted = await db
    .insert(userProfiles)
    .values({
      user_id: userId,
      role: role as 'owner' | 'ops_admin',
      account_status: 'active',
      email,
      first_name: firstName,
      last_name: lastName,
      display_name: displayName,
      onboarding_completed_at: now,
    })
    .returning();

  // Audit the staff creation (invariant 11) — never record the password.
  await db.insert(auditEvents).values({
    actor_user_id: p.userId,
    action: 'admin.staff_create',
    entity_type: 'user_profile',
    entity_id: userId,
    new_values: JSON.stringify({ role, email, account_status: 'active' }),
    timestamp: now,
    reason: 'Admin created a staff login',
  });

  return c.json(inserted[0] ?? null, 201);
});

/**
 * PATCH /api/admin/users/:id/role — promote/demote a user (admins only)
 */
route.patch('/users/:id/role', async (c) => {
  const p = c.get('principal');
  if (!isAdminRole(p.role)) return c.json({ error: 'Forbidden' }, 403);

  const { id } = c.req.param();
  const body = await c.req.json<{ role: string }>();
  const allowed = ['owner', 'ops_admin', 'contractor', 'client'] as const;
  if (!(allowed as readonly string[]).includes(body.role)) {
    return c.json({ error: 'Invalid role' }, 400);
  }
  const newRole = body.role as (typeof allowed)[number];

  const db = drizzle(c.env.DB);
  const target = await db.select().from(userProfiles).where(eq(userProfiles.id, id)).limit(1);
  const current = target[0];
  if (!current) return c.json({ error: 'not_found' }, 404);

  // Centralised least-privilege check: owner-only for privileged roles, no
  // self-edit (invariant 5), owner-only to change an existing owner.
  if (!canAssignRole(p, { user_id: current.user_id, role: current.role }, newRole)) {
    return c.json({ error: 'forbidden_role_change' }, 403);
  }

  const previous = current.role;
  await db
    .update(userProfiles)
    .set({ role: newRole, updated_at: new Date() })
    .where(eq(userProfiles.id, id));

  // Audit the role change (invariant 11).
  await db.insert(auditEvents).values({
    actor_user_id: p.userId,
    action: 'admin.role_change',
    entity_type: 'user_profile',
    entity_id: current.user_id,
    previous_values: JSON.stringify({ role: previous }),
    new_values: JSON.stringify({ role: newRole }),
    timestamp: new Date().toISOString(),
    reason: 'Admin changed a user role',
  });

  const updated = await db.select().from(userProfiles).where(eq(userProfiles.id, id)).limit(1);
  return c.json(updated[0] ?? null);
});

export default route;