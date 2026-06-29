import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { flatLinks } from './navConfig';

/**
 * Global command palette (cmdk). Opened from the top-bar search button or with
 * ⌘K / Ctrl-K; lists every destination the current role can reach and navigates
 * on select. `open`/`onOpenChange` are owned by the shell so the search button
 * and the shortcut share one dialog.
 */
export function CommandSearch({ role, open, onOpenChange }) {
  const navigate = useNavigate();
  const links = flatLinks(role);

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  function go(to) {
    onOpenChange(false);
    navigate(to);
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search pages and actions…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Go to">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <CommandItem
                key={link.to}
                value={`${link.group ? link.group + ' ' : ''}${link.label}`}
                onSelect={() => go(link.to)}
              >
                {Icon && <Icon className="mr-2 h-4 w-4 text-muted-foreground" />}
                <span>{link.label}</span>
                {link.group && (
                  <span className="ml-auto text-xs text-muted-foreground">{link.group}</span>
                )}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
