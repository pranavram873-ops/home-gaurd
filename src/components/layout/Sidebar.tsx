'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/authContext';
import { Icon } from '@/components/ui/Icon';
import { usePresence } from '@/lib/hooks/usePresence';

type Item = { label: string; href: string; icon: string; matches?: string[] };

/**
 * Navigation for both shapes the app takes: the bottom bar the Stitch screens
 * are built around, and - from `lg` up - a rail that also exposes the admin
 * modules that never fit in two tabs.
 */
export function Sidebar() {
  const pathname = usePathname();
  const { user, role, logout } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreMenu = usePresence(moreOpen, 320);
  const admin = role === 'admin';
  const primary: Item[] = admin
    ? [
        // The dashboard is the events list, so the tab doubles as "back from
        // Personnel" on mobile where there is no rail.
        { label: 'Events', href: '/admin/dashboard', icon: 'event_note' },
        { label: 'Personnel', href: '/admin/personnel', icon: 'groups' },
        { label: 'Reports', href: '/admin/reports', icon: 'assignment_late' },
      ]
    : role === 'home_guard'
      ? [
          { label: 'Home', href: '/homeguard/dashboard', icon: 'home' },
          { label: 'Duties', href: '/homeguard/duties', icon: 'event_note' },
          { label: 'Tasks', href: '/homeguard/tasks', icon: 'checklist' },
          { label: 'Attendance', href: '/homeguard/attendance', icon: 'fact_check' },
        ]
      : [
          // Return to the current district workspace; Change district opens the chooser.
          {
            label: 'Attendance',
            href: '/incharge/attendance',
            icon: 'fact_check',
            matches: ['/incharge/divisions', '/incharge/attendance'],
          },
          { label: 'Reports', href: '/incharge/reports', icon: 'assignment_late' },
        ];
  const secondary: Item[] = admin
    ? [
        { label: 'Change district', href: '/admin/divisions', icon: 'domain' },
      ]
    : role === 'home_guard'
      ? [
          { label: 'GPS check-in', href: '/homeguard/location', icon: 'location_on' },
          { label: 'My reports', href: '/homeguard/reports', icon: 'description' },
          { label: 'My profile', href: '/homeguard/profile', icon: 'badge' },
        ]
      : [
          { label: 'Change district', href: '/incharge/divisions', icon: 'domain' },
        ];

  const active = (item: Item) =>
    (item.matches ?? [item.href]).some((href) => pathname === href || pathname.startsWith(`${href}/`));

  const railLink = (item: Item) => {
    const selected = active(item);
    return (
      <Link
        key={`${item.label}-${item.href}`}
        href={item.href}
        aria-current={selected ? 'page' : undefined}
        className={`group press-scale flex items-center gap-3 rounded-xl px-3 py-2.5 text-label-md transition-all duration-200 ${
          selected ? 'bg-primary-container font-bold text-on-primary shadow-sm shadow-primary/10' : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
        }`}
      >
        <Icon icon={item.icon} size={20} fill={selected} className="transition-transform duration-200 group-hover:scale-110" />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  };

  const tabLink = (item: Item) => {
    const selected = active(item);
    return (
      <Link
        key={`tab-${item.label}-${item.href}`}
        href={item.href}
        aria-current={selected ? 'page' : undefined}
        aria-label={item.label}
        title={item.label}
        className={`group press-scale flex min-h-[44px] w-full min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 py-1 transition-all duration-200 active:scale-95 ${
          selected ? 'text-primary-container' : 'text-on-surface-variant hover:text-on-surface'
        }`}
      >
        <Icon icon={item.icon} size={24} fill={selected} className={`transition-transform duration-200 ${selected ? 'scale-110' : 'group-hover:scale-105'}`} />
        <span className={`max-w-full truncate text-[11px] leading-3 transition-colors duration-200 ${selected ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
      </Link>
    );
  };

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col border-r border-outline-variant/60 bg-surface-container-lowest lg:flex">
        <div className="flex items-center gap-2.5 border-b border-surface-container px-5 py-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-container text-secondary-container ring-1 ring-primary/10">
            <Icon icon="local_police" size={22} />
          </span>
          <div className="min-w-0">
            <p className="text-label-sm font-bold uppercase tracking-[0.14em] text-secondary">Tamil Nadu Police</p>
            <p className="truncate text-[15px] font-bold text-on-surface">Home Guards</p>
            <p className="truncate text-body-md text-on-surface-variant">Field Operations</p>
          </div>
        </div>

        <div className="px-4 pt-5">
          <p className="px-3 pb-2 text-label-sm font-bold uppercase tracking-[0.14em] text-on-surface-variant">Workspace</p>
          <nav className="flex flex-col gap-1">{primary.map(railLink)}</nav>
        </div>
        {secondary.length > 0 && (
          <div className="px-4 pt-6">
            <p className="px-3 pb-2 text-label-sm font-bold uppercase tracking-[0.14em] text-on-surface-variant">Operations</p>
            <nav className="flex flex-col gap-1">{secondary.map(railLink)}</nav>
          </div>
        )}

        <div className="mt-auto border-t border-surface-container p-4">
          <div className="mb-3 flex items-center gap-3 rounded-xl bg-surface-container-low p-3 transition-all duration-200 hover:bg-surface-container">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-sm font-bold text-primary-container shadow-xs transition-transform duration-200 hover:scale-105">
              {user?.full_name?.charAt(0).toUpperCase() || <Icon icon="person" size={18} />}
            </span>
            <div className="min-w-0">
              <p className="truncate text-label-lg text-on-surface">{user?.full_name || 'Signed in'}</p>
              <p className="truncate text-body-md text-xs text-on-surface-variant">
                {admin ? 'Administrator' : role === 'home_guard' ? 'Home Guard' : 'Incharge'}
                {user?.personnel_id ? ` · ${user.personnel_id}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={() => void logout()}
            className="flex h-10 w-full items-center gap-2 rounded-lg px-3 text-label-md text-on-surface-variant transition-all duration-200 hover:bg-surface-container hover:text-on-surface active:scale-[0.98]"
          >
            <Icon icon="logout" size={20} />
            Sign out
          </button>
        </div>
      </aside>

      {pathname !== '/admin/divisions' && pathname !== '/incharge/divisions' && <nav
        aria-label="Main navigation"
        className="fixed inset-x-0 bottom-0 z-50 grid h-16 grid-flow-col auto-cols-fr justify-items-stretch border-t border-outline-variant/60 bg-surface-container-lowest/95 pb-safe shadow-[0_-4px_18px_rgba(20,42,58,.09)] backdrop-blur-xl lg:hidden"
      >
        {primary.slice(0, 4).map(tabLink)}
        <button
          type="button"
          aria-expanded={moreOpen}
          aria-label={moreOpen ? 'Close menu' : 'More'}
          title="More"
          onClick={() => setMoreOpen((value) => !value)}
          className={`flex min-h-[44px] w-full min-w-0 flex-col items-center justify-center gap-0.5 py-1 transition-colors ${
            moreOpen ? 'text-primary-container' : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <Icon icon={moreOpen ? 'close' : 'menu'} size={24} />
          <span className={`text-[11px] leading-3 ${moreOpen ? 'font-bold' : 'font-medium'}`}>More</span>
        </button>
      </nav>}

      {moreMenu.mounted && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <button aria-label="Close navigation" data-open={moreMenu.visible} onClick={() => setMoreOpen(false)} className="sheet-scrim" />
          <section
            role="dialog"
            aria-modal="true"
            aria-label="All features"
            data-open={moreMenu.visible}
            className="sheet-panel sheet-from-bottom absolute inset-x-0 bottom-0 max-h-[82dvh] overflow-y-auto rounded-t-2xl bg-surface-container-lowest px-5 pt-3 pb-[calc(5rem+env(safe-area-inset-bottom))] shadow-2xl sm:max-w-none"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-outline-variant" aria-hidden />
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-headline-md text-on-surface">All features</p>
                <p className="text-body-md text-sm text-on-surface-variant">{admin ? 'Command and administration' : 'Your field workspace'}</p>
              </div>
              <button
                onClick={() => setMoreOpen(false)}
                aria-label="Close"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-on-surface-variant"
              >
                <Icon icon="close" size={20} />
              </button>
            </div>
            {(admin || role === 'incharge') && (
              <Link
                href={admin ? '/admin/divisions' : '/incharge/divisions'}
                onClick={() => setMoreOpen(false)}
                className="mb-4 flex min-h-[64px] items-center gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-3 text-label-lg text-on-surface transition-colors hover:bg-surface-container-low"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-fixed text-primary">
                  <Icon icon="domain" size={20} />
                </span>
                <span>Change district</span>
              </Link>
            )}
            <div className="flex items-center justify-between border-t border-outline-variant/60 pt-4">
              <div className="min-w-0">
                <p className="truncate text-label-lg text-on-surface">{user?.full_name || 'Signed in'}</p>
                <p className="text-body-md text-xs text-on-surface-variant">{admin ? 'Administrator' : role === 'home_guard' ? 'Home Guard' : 'Incharge'}</p>
              </div>
              <button
                onClick={() => void logout()}
                className="flex h-10 items-center gap-2 rounded-lg px-3 text-label-md text-on-surface-variant hover:text-on-surface"
              >
                <Icon icon="logout" size={20} />
                Sign out
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
