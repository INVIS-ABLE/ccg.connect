import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Briefcase, FileText, MessageSquare, User, ChevronLeft } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const tabs = [
  { path: '/client', icon: LayoutDashboard, label: 'Home' },
  { path: '/client/projects', icon: Briefcase, label: 'Projects' },
  { path: '/client/documents', icon: FileText, label: 'Documents' },
  { path: '/client/messages', icon: MessageSquare, label: 'Messages' },
  { path: '/client/profile', icon: User, label: 'Profile' },
];

const TAB_ROOTS = tabs.map(t => t.path);

export default function ClientLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isChildScreen = !TAB_ROOTS.includes(location.pathname);

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex items-center gap-3 px-4 py-3 bg-[hsl(210,22%,14%)] border-b border-white/10 flex-shrink-0" style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}>
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
          <div className="w-7 h-7 bg-primary rounded flex items-center justify-center">
            <span className="text-white text-xs font-bold">C</span>
          </div>
          <span className="text-white font-bold text-sm">CCG Connect</span>
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
          const active = location.pathname === path || (path !== '/client' && location.pathname.startsWith(path));
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