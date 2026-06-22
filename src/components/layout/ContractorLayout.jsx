import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Briefcase, Clock, Camera, User, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { path: '/contractor', icon: LayoutDashboard, label: 'Home' },
  { path: '/contractor/jobs', icon: Briefcase, label: 'Jobs' },
  { path: '/contractor/calendar', icon: CalendarDays, label: 'Schedule' },
  { path: '/contractor/timesheets', icon: Clock, label: 'Time' },
  { path: '/contractor/media', icon: Camera, label: 'Photos' },
  { path: '/contractor/profile', icon: User, label: 'Profile' },
];

export default function ContractorLayout({ children }) {
  const location = useLocation();

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex items-center px-4 py-3 bg-[#0e1117] border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2">
          <img
            src="https://media.base44.com/images/public/6a388c0a71495eb772ec6ebb/fe81b6bc2_cookconstructiongrowthlogo.png"
            alt="CCG"
            className="h-7 w-auto object-contain"
            style={{ filter: 'brightness(0) invert(1)' }}
          />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-border flex items-stretch z-30">
        {tabs.map(({ path, icon: Icon, label }) => {
          const active = location.pathname === path || (path !== '/contractor' && location.pathname.startsWith(path));
          return (
            <Link
              key={path}
              to={path}
              className={cn(
                'flex-1 flex flex-col items-center justify-center py-2 text-xs font-medium transition-colors',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Icon className={cn('w-5 h-5 mb-0.5', active ? 'text-primary' : 'text-muted-foreground')} />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}