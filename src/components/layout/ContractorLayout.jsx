import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Briefcase, Clock, Camera, User, CalendarDays, ChevronLeft } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const tabs = [
  { path: '/contractor', icon: LayoutDashboard, label: 'Home' },
  { path: '/contractor/jobs', icon: Briefcase, label: 'Jobs' },
  { path: '/contractor/calendar', icon: CalendarDays, label: 'Schedule' },
  { path: '/contractor/timesheets', icon: Clock, label: 'Time' },
  { path: '/contractor/media', icon: Camera, label: 'Photos' },
  { path: '/contractor/profile', icon: User, label: 'Profile' },
];

// Tab root paths — if current path exactly matches one of these, it's a root screen (no back button)
const TAB_ROOTS = tabs.map(t => t.path);

export default function ContractorLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isChildScreen = !TAB_ROOTS.includes(location.pathname);

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex items-center gap-3 px-4 py-3 bg-[#0e1117] border-b border-white/10 flex-shrink-0" style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}>
        {isChildScreen && (
          <button
            onClick={() => navigate(-1)}
            className="text-white/70 hover:text-white flex items-center gap-1 text-sm -ml-1 flex-shrink-0"
            aria-label="Go back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
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
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -18 }}
            transition={{ duration: 0.16, ease: 'easeInOut' }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-border flex items-stretch z-30" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {tabs.map(({ path, icon: Icon, label }) => {
          const active = location.pathname === path || (path !== '/contractor' && location.pathname.startsWith(path));
          return (
            <Link
              key={path}
              to={path}
              replace={active}
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