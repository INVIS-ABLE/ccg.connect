import { NavLink } from 'react-router-dom';
import { useAuth } from '@/app/auth/AuthProvider';
import { isAdminRole } from '@/domain/auth/roles';
import { Button } from '@/components/ui/button';

const ADMIN_NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/jobs', label: 'Jobs' },
  { to: '/contractors', label: 'Contractors' },
  { to: '/leads', label: 'Leads' },
];

/** Authenticated layout: brand header, role-aware nav, current user, sign-out. */
export function AppShell({ children }) {
  const { profile, principal, signOut } = useAuth();
  const role = principal?.role;
  const name =
    profile?.display_name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') ||
    profile?.email ||
    'Account';
  const nav = isAdminRole(role) ? ADMIN_NAV : [{ to: '/', label: 'Home', end: true }];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <div className="text-lg font-bold">
              CCG<span className="text-primary">Connect</span>
            </div>
            <nav className="hidden items-center gap-1 sm:flex">
              {nav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-muted-foreground sm:inline">
              {name}
              {role ? ` · ${role}` : ''}
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
