/**
 * Canonical role + route-permission model for CCG Connect.
 *
 * Two distinct role namespaces exist and MUST NOT be conflated:
 *  - Platform role (`User.role`): the Base44 platform account role, only ever
 *    `admin | user`. Do not use it for application authorization decisions.
 *  - App role (`UserProfile.role`): the CCG Connect domain role that actually
 *    governs what a person can see and do.
 *
 * This module is pure (no SDK imports) so it can be unit-tested and reused by
 * both the React app and Base44 backend functions.
 */

export const APP_ROLES = ['owner', 'ops_admin', 'contractor', 'client'] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const PLATFORM_ROLES = ['admin', 'user'] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

/** The privileged "admin" app roles. */
export const ADMIN_ROLES: readonly AppRole[] = ['owner', 'ops_admin'];

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === 'string' && (APP_ROLES as readonly string[]).includes(value);
}

export const isAdminRole = (role: AppRole | null | undefined): boolean =>
  role === 'owner' || role === 'ops_admin';
export const isOwnerRole = (role: AppRole | null | undefined): boolean => role === 'owner';
export const isContractorRole = (role: AppRole | null | undefined): boolean => role === 'contractor';
export const isClientRole = (role: AppRole | null | undefined): boolean => role === 'client';

/**
 * Route groups. Every protected route belongs to exactly one group, and a role
 * may only enter its own group(s). Admins may enter the admin group only — they
 * do not get to impersonate contractor/client surfaces by default.
 */
export type RouteGroup = 'admin' | 'contractor' | 'client';

const GROUP_FOR_ROLE: Record<AppRole, RouteGroup> = {
  owner: 'admin',
  ops_admin: 'admin',
  contractor: 'contractor',
  client: 'client',
};

/** The route group a role's UI lives in, or null for an unknown role. */
export function routeGroupForRole(role: AppRole | null | undefined): RouteGroup | null {
  if (!isAppRole(role)) return null;
  return GROUP_FOR_ROLE[role];
}

const HOME_FOR_GROUP: Record<RouteGroup, string> = {
  admin: '/',
  contractor: '/contractor',
  client: '/client',
};

/** Where a role should land after login / when redirected away from a forbidden route. */
export function homePathForRole(role: AppRole | null | undefined): string {
  const group = routeGroupForRole(role);
  return group ? HOME_FOR_GROUP[group] : '/';
}

/**
 * Determine which route group a path belongs to. Paths are grouped by prefix:
 *  - `/contractor*` -> contractor
 *  - `/client*`     -> client
 *  - everything else (admin console) -> admin
 */
export function routeGroupForPath(path: string): RouteGroup {
  const p = path.toLowerCase();
  if (p === '/contractor' || p.startsWith('/contractor/')) return 'contractor';
  if (p === '/client' || p.startsWith('/client/')) return 'client';
  return 'admin';
}

/** Whether a role is permitted to access a given route group. */
export function canAccessGroup(role: AppRole | null | undefined, group: RouteGroup): boolean {
  return routeGroupForRole(role) === group;
}

/** Whether a role is permitted to access a given path. */
export function canAccessPath(role: AppRole | null | undefined, path: string): boolean {
  return canAccessGroup(role, routeGroupForPath(path));
}
