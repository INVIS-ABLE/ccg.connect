import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { MoreHorizontal, LogOut } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { bottomNavForRole, flatLinks } from './navConfig';

function tabClass({ isActive }) {
  return `flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
    isActive ? 'text-primary' : 'text-muted-foreground'
  }`;
}

/** Bottom tab bar + a “More” drawer holding the full section list (mobile only). */
export function MobileNavigation({ role, onSignOut }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const navigate = useNavigate();
  const tabs = bottomNavForRole(role);
  const all = flatLinks(role);

  function go(to) {
    setMoreOpen(false);
    navigate(to);
  }

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-card lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-stretch">
          {tabs.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={tabClass}>
              {Icon && <Icon size={20} strokeWidth={1.75} />}
              <span>{label}</span>
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium text-muted-foreground"
          >
            <MoreHorizontal size={20} strokeWidth={1.75} />
            <span>More</span>
          </button>
        </div>
      </nav>

      <Drawer open={moreOpen} onOpenChange={setMoreOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Menu</DrawerTitle>
          </DrawerHeader>
          <div className="grid grid-cols-2 gap-2 px-4">
            {all.map((link) => {
              const Icon = link.icon;
              return (
                <button
                  key={link.to}
                  onClick={() => go(link.to)}
                  className="flex items-center gap-2 rounded-lg border px-3 py-3 text-left text-sm font-medium hover:bg-muted"
                >
                  {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
                  <span className="truncate">{link.label}</span>
                </button>
              );
            })}
          </div>
          <div className="p-4">
            <Button variant="outline" className="w-full gap-2" onClick={onSignOut}>
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
