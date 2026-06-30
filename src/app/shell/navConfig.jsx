import {
  Home,
  Briefcase,
  LayoutGrid,
  CalendarDays,
  Sparkles,
  Users,
  Building2,
  UserPlus,
  UserCog,
  Clock,
  FileText,
  BarChart3,
  ShieldCheck,
  MessageSquare,
  FolderKanban,
  Send,
  IdCard,
  User,
} from 'lucide-react';
import { isAdminRole } from '@/domain/auth/roles';

/**
 * Single source of truth for navigation. The whole app's IA collapses into a
 * handful of role-specific sections (CCG Connect upgrade plan, step 2). Items
 * flagged `soon` are part of the planned IA but have no route yet — they render
 * disabled so the structure is visible without 404s.
 *
 * Shape:
 *   { label, to, icon, end? }                       → a direct link
 *   { label, icon, items: [{ label, to, icon, soon? }] } → a group
 */
const ADMIN_NAV = [
  { label: 'Home', to: '/', icon: Home, end: true },
  {
    label: 'Work',
    icon: Briefcase,
    items: [
      { label: 'Jobs', to: '/jobs', icon: Briefcase },
      { label: 'Job Board', to: '/job-board', icon: LayoutGrid },
      { label: 'Calendar', to: '/calendar', icon: CalendarDays },
      { label: 'Matching', to: '/match-engine', icon: Sparkles },
    ],
  },
  {
    label: 'People',
    icon: Users,
    items: [
      { label: 'Contractors', to: '/contractors', icon: Users },
      { label: 'Clients', to: '/clients', icon: Building2 },
      { label: 'Leads', to: '/leads', icon: UserPlus },
      { label: 'Users', to: '/users', icon: UserCog },
    ],
  },
  { label: 'Commercial', to: '/commercial', icon: Building2 },
  {
    label: 'Money',
    icon: FileText,
    items: [
      { label: 'Timesheets', to: '/timesheets', icon: Clock },
      { label: 'Invoices', to: '/invoices', icon: FileText },
      { label: 'Reports', to: '/reports', icon: BarChart3 },
    ],
  },
  { label: 'Compliance', to: '/compliance', icon: ShieldCheck },
  { label: 'Messages', to: '/messages', icon: MessageSquare },
];

const CONTRACTOR_NAV = [
  { label: 'Home', to: '/', icon: Home, end: true },
  { label: 'My Jobs', to: '/contractor/jobs', icon: Briefcase },
  { label: 'Time', to: '/contractor/timesheets', icon: Clock },
  { label: 'Documents', to: '/contractor/credentials', icon: IdCard },
  { label: 'Messages', to: '/messages', icon: MessageSquare },
  { label: 'Profile', to: '/contractor/profile', icon: User },
];

const CLIENT_NAV = [
  { label: 'Home', to: '/', icon: Home, end: true },
  { label: 'Projects', to: '/client/projects', icon: FolderKanban },
  { label: 'Submit Job', to: '/client/submit-job', icon: Send },
  { label: 'Messages', to: '/messages', icon: MessageSquare },
];

export function navForRole(role) {
  if (isAdminRole(role)) return ADMIN_NAV;
  if (role === 'contractor') return CONTRACTOR_NAV;
  if (role === 'client') return CLIENT_NAV;
  return [{ label: 'Home', to: '/', icon: Home, end: true }];
}

/** Flattened, navigable (non-`soon`) links — for the command palette + search. */
export function flatLinks(role) {
  const out = [];
  for (const entry of navForRole(role)) {
    if (entry.items) {
      for (const item of entry.items) if (!item.soon) out.push({ ...item, group: entry.label });
    } else {
      out.push({ ...entry, group: null });
    }
  }
  return out;
}

/** The 4 primary destinations for the mobile bottom bar (rest live in “More”). */
export function bottomNavForRole(role) {
  if (isAdminRole(role)) {
    return [
      { label: 'Home', to: '/', icon: Home, end: true },
      { label: 'Jobs', to: '/jobs', icon: Briefcase },
      { label: 'Messages', to: '/messages', icon: MessageSquare },
    ];
  }
  if (role === 'contractor') {
    return [
      { label: 'Home', to: '/', icon: Home, end: true },
      { label: 'Jobs', to: '/contractor/jobs', icon: Briefcase },
      { label: 'Time', to: '/contractor/timesheets', icon: Clock },
      { label: 'Messages', to: '/messages', icon: MessageSquare },
    ];
  }
  if (role === 'client') {
    return [
      { label: 'Home', to: '/', icon: Home, end: true },
      { label: 'Projects', to: '/client/projects', icon: FolderKanban },
      { label: 'Messages', to: '/messages', icon: MessageSquare },
    ];
  }
  return [{ label: 'Home', to: '/', icon: Home, end: true }];
}
