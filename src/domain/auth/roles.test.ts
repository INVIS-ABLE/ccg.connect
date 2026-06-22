import { describe, it, expect } from 'vitest';
import {
  APP_ROLES,
  isAppRole,
  isAdminRole,
  isContractorRole,
  isClientRole,
  routeGroupForRole,
  routeGroupForPath,
  canAccessGroup,
  canAccessPath,
  homePathForRole,
} from './roles';

describe('app role guards', () => {
  it('recognises only valid app roles', () => {
    for (const r of APP_ROLES) expect(isAppRole(r)).toBe(true);
    expect(isAppRole('admin')).toBe(false); // platform role, not an app role
    expect(isAppRole('user')).toBe(false);
    expect(isAppRole('')).toBe(false);
    expect(isAppRole(undefined)).toBe(false);
    expect(isAppRole(null)).toBe(false);
  });

  it('classifies admin roles', () => {
    expect(isAdminRole('owner')).toBe(true);
    expect(isAdminRole('ops_admin')).toBe(true);
    expect(isAdminRole('contractor')).toBe(false);
    expect(isAdminRole('client')).toBe(false);
    expect(isAdminRole(null)).toBe(false);
  });

  it('classifies contractor and client roles', () => {
    expect(isContractorRole('contractor')).toBe(true);
    expect(isClientRole('client')).toBe(true);
    expect(isContractorRole('owner')).toBe(false);
    expect(isClientRole('owner')).toBe(false);
  });
});

describe('route groups', () => {
  it('maps roles to their group', () => {
    expect(routeGroupForRole('owner')).toBe('admin');
    expect(routeGroupForRole('ops_admin')).toBe('admin');
    expect(routeGroupForRole('contractor')).toBe('contractor');
    expect(routeGroupForRole('client')).toBe('client');
    expect(routeGroupForRole('nonsense' as never)).toBeNull();
  });

  it('maps paths to groups by prefix', () => {
    expect(routeGroupForPath('/')).toBe('admin');
    expect(routeGroupForPath('/jobs')).toBe('admin');
    expect(routeGroupForPath('/contractors')).toBe('admin'); // admin "contractors" list
    expect(routeGroupForPath('/contractor')).toBe('contractor');
    expect(routeGroupForPath('/contractor/jobs')).toBe('contractor');
    expect(routeGroupForPath('/client')).toBe('client');
    expect(routeGroupForPath('/client/projects')).toBe('client');
  });

  it('does not confuse /contractors (admin) with /contractor (contractor)', () => {
    expect(routeGroupForPath('/contractors')).toBe('admin');
    expect(routeGroupForPath('/contractors/123')).toBe('admin');
    expect(routeGroupForPath('/contractor')).toBe('contractor');
  });
});

describe('access control', () => {
  it('confines each role to its own group', () => {
    expect(canAccessGroup('owner', 'admin')).toBe(true);
    expect(canAccessGroup('owner', 'contractor')).toBe(false);
    expect(canAccessGroup('contractor', 'admin')).toBe(false);
    expect(canAccessGroup('contractor', 'contractor')).toBe(true);
    expect(canAccessGroup('client', 'client')).toBe(true);
    expect(canAccessGroup('client', 'admin')).toBe(false);
  });

  it('blocks a contractor from admin paths', () => {
    expect(canAccessPath('contractor', '/jobs')).toBe(false);
    expect(canAccessPath('contractor', '/contractors')).toBe(false);
    expect(canAccessPath('contractor', '/contractor/jobs')).toBe(true);
  });

  it('blocks a client from admin and contractor paths', () => {
    expect(canAccessPath('client', '/')).toBe(false);
    expect(canAccessPath('client', '/contractor')).toBe(false);
    expect(canAccessPath('client', '/client/projects')).toBe(true);
  });

  it('blocks an unknown role from everything', () => {
    expect(canAccessPath(null, '/')).toBe(false);
    expect(canAccessPath(undefined, '/client')).toBe(false);
  });
});

describe('home paths', () => {
  it('routes each role to its landing page', () => {
    expect(homePathForRole('owner')).toBe('/');
    expect(homePathForRole('ops_admin')).toBe('/');
    expect(homePathForRole('contractor')).toBe('/contractor');
    expect(homePathForRole('client')).toBe('/client');
    expect(homePathForRole(null)).toBe('/');
  });
});
