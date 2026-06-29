import { NavLink } from 'react-router-dom';
import { navForRole } from './navConfig';

const CCG_LOGO = '/ccg-logo.png';

function NavRow({ item }) {
  const Icon = item.icon;
  if (item.soon) {
    return (
      <span className="flex cursor-default items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground/60">
        {Icon && <Icon className="h-4 w-4" />}
        <span>{item.label}</span>
        <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          Soon
        </span>
      </span>
    );
  }
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        `flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium transition-colors ${
          isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        }`
      }
    >
      {Icon && <Icon className="h-4 w-4" />}
      <span>{item.label}</span>
    </NavLink>
  );
}

/** Fixed left navigation (desktop only). Collapses the whole app into the
 *  role's handful of sections. */
export function DesktopSidebar({ role }) {
  const nav = navForRole(role);
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-card lg:flex">
      <div className="flex h-16 items-center border-b px-4">
        <NavLink to="/" aria-label="Home">
          <img
            src={CCG_LOGO}
            alt="Cook Construction Growth"
            className="h-8 w-auto object-contain"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </NavLink>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto p-3">
        {nav.map((entry) =>
          entry.items ? (
            <div key={entry.label}>
              <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {entry.label}
              </p>
              <div className="space-y-0.5">
                {entry.items.map((item) => (
                  <NavRow key={item.label} item={item} />
                ))}
              </div>
            </div>
          ) : (
            <NavRow key={entry.label} item={entry} />
          ),
        )}
      </nav>
    </aside>
  );
}
