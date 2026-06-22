import { useAuth } from '@/app/auth/AuthProvider';
import { Button } from '@/components/ui/button';

/** Authenticated layout: brand header, current user, sign-out. */
export function AppShell({ children }) {
  const { profile, principal, signOut } = useAuth();
  const name =
    profile?.display_name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') ||
    profile?.email ||
    'Account';

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="text-lg font-bold">
            CCG<span className="text-primary">Connect</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              {name}
              {principal?.role ? ` · ${principal.role}` : ''}
            </span>
            <Button variant="outline" size="sm" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
