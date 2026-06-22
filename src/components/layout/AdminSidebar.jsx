import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Briefcase, Target, Users, Building2,
  ShieldCheck, MessageSquare, Clock, FileText, BarChart3,
  Settings, ChevronRight, Bell, LogOut, Menu, CalendarDays, ChevronLeft
} from 'lucide-react';
import { HardHat } from 'lucide-react';
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Command Centre' },
  { path: '/jobs', icon: Briefcase, label: 'Jobs' },
  { path: '/match-centre', icon: Target, label: 'Match Centre' },
  { path: '/contractors', icon: HardHat, label: 'Contractors' },
  { path: '/clients', icon: Building2, label: 'Clients' },
  { path: '/compliance', icon: ShieldCheck, label: 'Compliance' },
  { path: '/messages', icon: MessageSquare, label: 'Messages' },
  { path: '/timesheets', icon: Clock, label: 'Timesheets' },
  { path: '/invoices', icon: FileText, label: 'Invoices' },
  { path: '/reports', icon: BarChart3, label: 'Reports' },
  { path: '/leads', icon: Users, label: 'Leads' },
  { path: '/calendar', icon: CalendarDays, label: 'Calendar' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

const NAV_ROOTS = new Set(['/', '/jobs', '/match-centre', '/contractors', '/clients', '/compliance', '/messages', '/timesheets', '/invoices', '/reports', '/leads', '/calendar', '/settings']);

export default function AdminSidebar({ userProfile, children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isChildScreen = !NAV_ROOTS.has(location.pathname);

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10">
        <img
          src="https://media.base44.com/images/public/6a388c0a71495eb772ec6ebb/fe81b6bc2_cookconstructiongrowthlogo.png"
          alt="Cook Construction Growth"
          className="h-9 w-auto object-contain"
          style={{ filter: 'brightness(0) invert(1)' }}
        />
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {navItems.map(({ path, icon: Icon, label }) => {
          const active = location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
          return (
            <Link
              key={path}
              to={path}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm font-medium transition-all',
                active ? 'bg-primary text-white' : 'text-white/65 hover:text-white hover:bg-white/10'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{label}</span>
              {active && <ChevronRight className="w-3 h-3 ml-auto" />}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
          <div className="w-8 h-8 bg-primary/30 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">
              {userProfile?.first_name?.[0] || userProfile?.email?.[0]?.toUpperCase() || 'A'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-xs font-medium truncate">
              {userProfile?.first_name ? `${userProfile.first_name} ${userProfile.last_name || ''}`.trim() : userProfile?.email}
            </div>
            <div className="text-white/50 text-xs capitalize">{userProfile?.role?.replace('_', ' ')}</div>
          </div>
          <button onClick={() => base44.auth.logout()} className="text-white/40 hover:text-white transition-colors" title="Sign out">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <aside className="hidden lg:flex flex-col w-56 bg-[#0e1117] flex-shrink-0">
        <SidebarContent />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-[#0e1117] z-50" onClick={e => e.stopPropagation()}>
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-[#0e1117] border-b border-white/10 flex-shrink-0" style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}>
          {isChildScreen ? (
            <button onClick={() => navigate(-1)} className="text-white/70 hover:text-white" aria-label="Go back">
              <ChevronLeft className="w-5 h-5" />
            </button>
          ) : (
            <button onClick={() => setMobileOpen(true)} className="text-white">
              <Menu className="w-5 h-5" />
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
          {!isChildScreen && (
            <div className="ml-auto">
              <Link to="/notifications" className="text-white/70 hover:text-white">
                <Bell className="w-5 h-5" />
              </Link>
            </div>
          )}
        </header>
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}