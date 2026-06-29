import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/app/auth/AuthProvider';
import { isAdminRole } from '@/domain/auth/roles';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';
import { NotificationsBell } from '@/app/NotificationsBell';
import ContractorMobileNav from '@/app/components/ContractorMobileNav';

// Served from public/ — the Cook Construction Growth brand logo.
const CCG_LOGO = '/ccg-logo.png';

const ADMIN_NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/jobs', label: 'Jobs' },
  { to: '/contractors', label: 'Contractors' },
  { to: '/compliance', label: 'Compliance' },
  { to: '/leads', label: 'Leads' },
  { to: '/invoices', label: 'Invoices' },
  { to: '/job-board', label: 'Job Board' },
  { to: '/match-engine', label: 'Match Engine' },
  { to: '/users', label: 'Users' },
  { to: '/messages', label: 'Messages' },
];

const CONTRACTOR_NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/contractor/jobs', label: 'My jobs' },
  { to: '/contractor/timesheets', label: 'Timesheets' },
  { to: '/contractor/credentials', label: 'Credentials' },
  { to: '/contractor/profile', label: 'Profile' },
  { to: '/messages', label: 'Messages' },
];

const CLIENT_NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/client/projects', label: 'Projects' },
  { to: '/client/submit-job', label: 'Submit a job' },
  { to: '/messages', label: 'Messages' },
];

function navForRole(role) {
  if (isAdminRole(role)) return ADMIN_NAV;
  if (role === 'contractor') return CONTRACTOR_NAV;
  if (role === 'client') return CLIENT_NAV;
  return [{ to: '/', label: 'Home', end: true }];
}

// The label of the nav entry that best matches the current path, for the menu
// button (so the user always sees where they are).
function currentLabel(nav, pathname) {
  let best = null;
  for (const item of nav) {
    if (item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(item.to + '/')) {
      if (!best || item.to.length > best.to.length) best = item;
    }
  }
  return best?.label ?? 'Menu';
}

export function AppShell({ children }) {
  const { profile, principal, signOut } = useAuth();
  const { pathname } = useLocation();
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
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <NavLink to="/" className="shrink-0" aria-label="Home">
              <img
                src={CCG_LOGO}
                alt="Cook Construction Growth"
                className="h-8 w-auto object-contain sm:h-9"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </NavLink>

            {/* Compact dropdown nav — works the same on phone and desktop, and
                keeps the header short however many sections a role has. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="max-w-[60vw] gap-1.5">
                  <span className="truncate">{currentLabel(nav, pathname)}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Menu</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {nav.map((item) => (
                  <DropdownMenuItem key={item.to} asChild>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        `w-full cursor-pointer ${isActive ? 'font-semibold text-primary' : ''}`
                      }
                    >
                      {item.label}
                    </NavLink>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex shrink-0 items-center gap-2 text-sm">
            <NotificationsBell />
            <span className="hidden text-muted-foreground md:inline">
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
