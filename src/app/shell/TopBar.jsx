import { Search } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NotificationsBell } from '@/app/NotificationsBell';

const CCG_LOGO = '/ccg-logo.png';

function initials(name) {
  return (name || 'U')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

/** Sticky top bar: mobile logo, global search trigger, alerts, user menu. */
export function TopBar({ role, name, onOpenSearch, onSignOut }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-card px-3 sm:px-4">
      <img
        src={CCG_LOGO}
        alt="Cook Construction Growth"
        className="h-7 w-auto object-contain lg:hidden"
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />

      <button
        type="button"
        onClick={onOpenSearch}
        className="flex max-w-md flex-1 items-center gap-2 rounded-md border bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
      >
        <Search size={15} />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="hidden rounded border bg-background px-1.5 text-[10px] font-medium sm:inline">⌘K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-1.5">
        <NotificationsBell />
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-secondary text-xs font-semibold text-secondary-foreground">
                {initials(name)}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col">
              <span className="truncate">{name}</span>
              {role && <span className="text-xs font-normal capitalize text-muted-foreground">{role.replace('_', ' ')}</span>}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onSignOut}>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
