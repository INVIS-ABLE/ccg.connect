import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { authClient, useSession } from '@/api/authClient';
import { api, ApiError } from '@/api/client';
import type { Principal, UserProfile } from '@/api/types';

interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  principal: Principal | null;
  profile: UserProfile | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | null>(null);

/**
 * App auth state: Better Auth owns the session; the server's /api/me resolves the
 * caller's role + profile (the authoritative role lives in UserProfile, never the
 * client). Re-fetches whenever the session identity changes.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending } = useSession();
  const [principal, setPrincipal] = useState<Principal | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [meLoading, setMeLoading] = useState(false);

  const userId = session?.user?.id ?? null;

  const refresh = useCallback(async () => {
    if (!userId) {
      setPrincipal(null);
      setProfile(null);
      return;
    }
    setMeLoading(true);
    try {
      const me = await api.me();
      setPrincipal(me.principal);
      setProfile(me.profile);
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 401) console.error('Failed to load /api/me', err);
      setPrincipal(null);
      setProfile(null);
    } finally {
      setMeLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value: AuthState = {
    isLoading: isPending || meLoading,
    isAuthenticated: Boolean(userId),
    principal,
    profile,
    refresh,
    signOut: async () => {
      await authClient.signOut();
      setPrincipal(null);
      setProfile(null);
    },
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
