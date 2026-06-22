import { createMiddleware } from 'hono/factory';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { createAuth } from '../auth';
import { userProfiles, contractorProfiles } from '../db/schema';
import { isAppRole } from '../../src/domain/auth/roles';
import type { Principal } from '../../src/domain/permissions/permissions';
import type { AppEnv } from '../env';

/**
 * Resolve the authenticated caller into a Principal: their Better Auth user, the
 * app role from UserProfile, and the contractor/client scope id used for record
 * authorization. Returns null when there is no valid session.
 *
 * Least privilege: an authenticated user with no UserProfile is treated as a
 * `contractor` with no contractor scope, so they can see nothing until an admin
 * provisions them.
 */
export async function resolvePrincipal(
  env: AppEnv['Bindings'],
  headers: Headers,
): Promise<Principal | null> {
  const auth = createAuth(env);
  const session = await auth.api.getSession({ headers });
  if (!session?.user?.id) return null;

  const userId = session.user.id;
  const db = drizzle(env.DB);

  const profileRows = await db
    .select({ role: userProfiles.role, client_id: userProfiles.client_id })
    .from(userProfiles)
    .where(eq(userProfiles.user_id, userId))
    .limit(1);
  const role = isAppRole(profileRows[0]?.role) ? profileRows[0]!.role : 'contractor';

  let contractorId: string | null = null;
  if (role === 'contractor') {
    const cp = await db
      .select({ id: contractorProfiles.id })
      .from(contractorProfiles)
      .where(eq(contractorProfiles.user_id, userId))
      .limit(1);
    contractorId = cp[0]?.id ?? null;
  }

  // A client user is linked to their Client org via user_profiles.client_id
  // (set by an admin); this scopes everything they can see.
  const clientId = role === 'client' ? (profileRows[0]?.client_id ?? null) : null;

  return { userId, role, contractorId, clientId };
}

/** Hono middleware: require a valid session, attach the Principal, else 401. */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const principal = await resolvePrincipal(c.env, c.req.raw.headers);
  if (!principal) return c.json({ error: 'unauthenticated' }, 401);
  c.set('principal', principal);
  await next();
});
