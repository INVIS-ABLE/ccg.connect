import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Briefcase, FileText, MessageSquare, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { path: '/client', icon: LayoutDashboard, label: 'Home' },
  { path: '/client/projects', icon: Briefcase, label: 'Projects' },
  { path: '/client/documents', icon: FileText, label: 'Documents' },
  { path: '/client/messages', icon: MessageSquare, label: 'Messages' },
  { path: '/client/profile', icon: User, label: 'Profile' },
];

export default function ClientLayout({ children }) {
  const location = useLocation();

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex items-center px-4 py-3 bg-[hsl(210,22%,14%)] border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary rounded flex items-center justify-center">
            <span className="text-white text-xs font-bold">C</span>
          </div>
          <span className="text-white font-bold text-sm">CCG Connect</span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-border flex items-stretch z-30">
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