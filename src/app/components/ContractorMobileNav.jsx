import { NavLink } from 'react-router-dom';
import { Home, Briefcase, Clock, ShieldCheck, User } from 'lucide-react';

const TABS = [
  { to: '/', icon: Home, label: 'Home', end: true },
  { to: '/contractor/jobs', icon: Briefcase, label: 'Jobs' },
  { to: '/contractor/timesheets', icon: Clock, label: 'Timesheets' },
  { to: '/contractor/credentials', icon: ShieldCheck, label: 'Documents' },
  { to: '/contractor/profile', icon: User, label: 'Profile' },
];

/**
 * Fixed bottom tab bar shown only on mobile for contractor role.
 * The "Jobs" tab is always prominently styled for quick access.
 */
export default function ContractorMobileNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card sm:hidden"
         style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-stretch">
        {TABS.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors
              ${to === '/contractor/jobs'
                ? isActive
                  ? 'text-primary bg-primary/10'
                  : 'text-primary/70 bg-primary/5'
                : isActive
                  ? 'text-primary'
                  : 'text-muted-foreground'
              }`
            }
          >
            <Icon size={20} strokeWidth={to === '/contractor/jobs' ? 2.5 : 1.75} />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}