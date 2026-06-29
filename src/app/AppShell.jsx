import { NavLink } from 'react-router-dom';
import { useAuth } from '@/app/auth/AuthProvider';
import { isAdminRole } from '@/domain/auth/roles';
import { Button } from '@/components/ui/button';
import { NotificationsBell } from '@/app/NotificationsBell';
import ContractorMobileNav from '@/app/components/ContractorMobileNav';

const ADMIN_NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/jobs', label: 'Jobs' },
  { to: '/contractors', label: 'Contractors' },
  { to: '/compliance', label: 'Compliance' },
  { to: '/leads', label: 'Leads' },
  { to: '/invoices', label: 'Invoices' },
  { to: '/users', label: 'Users' },
];

const CONTRACTOR_NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/contractor/jobs', label: 'My jobs' },
  { to: '/contractor/timesheets', label: 'Timesheets' },
  { to: '/contractor/credentials', label: 'Credentials' },
  { to: '/contractor/profile', label: 'Profile' },
];

const CLIENT_NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/client/projects', label: 'Projects' },
  { to: '/client/submit-job', label: 'Submit a job' },
];

function navForRole(role) {
  if (isAdminRole(role)) return ADMIN_NAV;
  if (role === 'contractor') return CONTRACTOR_NAV;
  if (role === 'client') return CLIENT_NAV;
  return [{ to: '/', label: 'Home', end: true }];
}

export function AppShell({ children }) {
  const { profile, principal, signOut } = useAuth();
  const role = principal?.role;
  const name =
    profile?.display_name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') ||
    profile?.email ||
    'Account';
  const nav = navForRole(role);

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
          <div className="flex items-center gap-2 text-sm">
            <NotificationsBell />
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
      <main className={`mx-auto max-w-6xl px-4 py-6 ${role === 'contractor' ? 'pb-24 sm:pb-6' : ''}`}>{children}</main>
      {role === 'contractor' && <ContractorMobileNav />}
    </div>
  );
}