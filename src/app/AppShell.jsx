import { useState } from 'react';
import { useAuth } from '@/app/auth/AuthProvider';
import { DesktopSidebar } from '@/app/shell/DesktopSidebar';
import { TopBar } from '@/app/shell/TopBar';
import { MobileNavigation } from '@/app/shell/MobileNavigation';
import { CommandSearch } from '@/app/shell/CommandSearch';

/**
 * Unified CCG Connect application shell (upgrade plan, step 1): a fixed desktop
 * sidebar + sticky top bar, a mobile bottom bar with a “More” drawer, and a
 * global command palette. Navigation collapses into the role's handful of
 * sections (see shell/navConfig).
 */
export function AppShell({ children }) {
  const { profile, principal, signOut } = useAuth();
  const role = principal?.role;
  const name =
    profile?.display_name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') ||
    profile?.email ||
    'Account';

  const [searchOpen, setSearchOpen] = useState(false);
  const doSignOut = () => void signOut();

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <DesktopSidebar role={role} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar
            role={role}
            name={name}
            onOpenSearch={() => setSearchOpen(true)}
            onSignOut={doSignOut}
          />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-24 lg:pb-6">{children}</main>
        </div>
      </div>

      <MobileNavigation role={role} onSignOut={doSignOut} />
      <CommandSearch role={role} open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
