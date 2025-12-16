import type { ReactNode } from 'react';

export type SidebarNavKey =
  | 'dashboard'
  | 'events'
  | 'team'
  | 'clients'
  | 'finance'
  | 'settings';

type SidebarProps = {
  activeItem?: SidebarNavKey;
  className?: string;
};

type NavItem = {
  key: SidebarNavKey;
  label: string;
  icon: ReactNode;
};

const sidebarWidth = 'w-full md:w-64 xl:w-72';

const navItems: NavItem[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
        <path d="M3 3h7v7H3z" />
        <path d="M14 3h7v4h-7z" />
        <path d="M14 11h7v10h-7z" />
        <path d="M3 14h7v7H3z" />
      </svg>
    ),
  },
  {
    key: 'events',
    label: 'Events',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
        <path d="M4 7h16" />
        <path d="M6 3v4" />
        <path d="M18 3v4" />
        <rect x="4" y="7" width="16" height="14" rx="2" />
        <path d="M8 11h8" />
      </svg>
    ),
  },
  {
    key: 'team',
    label: 'Team',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
        <circle cx="8" cy="7" r="3" />
        <circle cx="17" cy="7" r="3" />
        <path d="M2 21a6 6 0 0 1 12 0" />
        <path d="M12 21a6 6 0 0 1 12 0" />
      </svg>
    ),
  },
  {
    key: 'clients',
    label: 'Clients',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    key: 'finance',
    label: 'Finance',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <path d="M3 10h18" />
        <path d="M8 14h.01" />
        <path d="M12 14h4" />
      </svg>
    ),
  },
  {
    key: 'settings',
    label: 'Settings',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

export default function Sidebar({ activeItem = 'dashboard', className = '' }: SidebarProps) {
  return (
    <aside className={`flex flex-col bg-slate-950 text-slate-100 ${sidebarWidth} ${className}`.trim()}>
      <div className="border-b border-slate-800 px-6 py-6">
        <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Ziv Cocktails</p>
        <h1 className="mt-3 text-lg font-semibold text-slate-100">Admin Dashboard</h1>
      </div>

      <nav aria-label="Primary" className="flex-1 px-3 py-6">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = item.key === activeItem;
            return (
              <li key={item.key}>
                <a
                  href="#"
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'border-l-2 border-indigo-500 bg-slate-900/70 text-white shadow-sm'
                      : 'text-slate-300 hover:bg-slate-900/40 hover:text-white'
                  }`}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-slate-200">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-auto border-t border-slate-800 px-6 py-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500 text-sm font-semibold text-white">
            ZA
          </span>
          <div>
            <p className="text-sm font-medium text-white">Ziv Admin</p>
            <p className="text-xs text-slate-400">Owner</p>
          </div>
        </div>
        <button className="mt-4 text-xs font-medium text-slate-500 transition hover:text-slate-300">Log out</button>
      </div>
    </aside>
  );
}
