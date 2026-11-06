'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/authContext';
import { Icon } from '@/components/ui/Icon';

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
  const admin = role === 'admin';
  const primary: Item[] = admin
    ? [
        // The dashboard is the events list, so the tab doubles as "back from
        // Personnel" on mobile where there is no rail.
        { label: 'Events', href: '/admin/dashboard', icon: 'event_note' },
        { label: 'Personnel', href: '/admin/personnel', icon: 'groups' },
      ]
    : role === 'home_guard'
      ? [
          { label: 'Home', href: '/homeguard/dashboard', icon: 'home' },
          { label: 'Duties', href: '/homeguard/duties', icon: 'event_note' },
          { label: 'Tasks', href: '/homeguard/tasks', icon: 'checklist' },
          { label: 'Attendance', href: '/homeguard/attendance', icon: 'fact_check' },
        ]
      : [
          // The tab covers both the chooser landing screen and the muster.
          {
            label: 'Attendance',
            href: '/incharge/divisions',
            icon: 'fact_check',
            matches: ['/incharge/divisions', '/incharge/attendance'],
          },
          { label: 'Reports', href: '/incharge/reports', icon: 'assignment_late' },
        ];
  const secondary: Item[] = admin
    ? []
    : role === 'home_guard'
      ? [
          { label: 'GPS check-in', href: '/homeguard/location', icon: 'location_on' },
          { label: 'My reports', href: '/homeguard/reports', icon: 'description' },
          { label: 'My profile', href: '/homeguard/profile', icon: 'badge' },
        ]
      : [];

  const active = (item: Item) =>
    (item.matches ?? [item.href]).some((href) => pathname === href || pathname.startsWith(`${href}/`));

  const railLink = (item: Item) => {
    const selected = active(item);
    return (
      <Link
        key={`${item.label}-${item.href}`}
        href={item.href}
        aria-current={selected ? 'page' : undefined}
        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-label-md transition-colors ${
          selected ? 'bg-primary-container font-semibold text-on-primary' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
        }`}
      >
        <Icon icon={item.icon} size={20} fill={selected} />
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
        className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 py-1 transition-colors ${
          selected ? 'text-primary-container' : 'text-on-surface-variant hover:text-on-surface'
        }`}
      >
        <Icon icon={item.icon} size={24} fill={selected} />
        <span className={`text-label-md uppercase tracking-wider ${selected ? 'font-bold' : ''}`}>{item.label}</span>
        {/* The mockups mark the live tab with a bar rather than a filled pill. */}
        <span className={`h-1 w-5 rounded-full ${selected ? 'bg-primary' : 'bg-transparent'}`} aria-hidden />
      </Link>
    );
  };

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col border-r border-outline-variant/60 bg-surface-container-lowest lg:flex">
        <div className="flex items-center gap-2.5 border-b border-surface-container px-5 py-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-container text-secondary-container">
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
          <div className="mb-3 flex items-center gap-3 rounded-xl bg-surface-container-low p-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-sm font-bold text-primary-container">
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
            className="flex h-10 w-full items-center gap-2 rounded-lg px-3 text-label-md text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
          >
            <Icon icon="logout" size={20} />
            Sign out
          </button>
        </div>
      </aside>

      <nav
        aria-label="Main navigation"
        style={{ gridTemplateColumns: `repeat(${Math.min(primary.length + 1, 5)}, minmax(0, 1fr))` }}
        className="fixed inset-x-0 bottom-0 z-50 grid h-16 border-t border-outline-variant/60 bg-surface-container-lowest/95 pb-safe shadow-[0_-2px_10px_rgba(18,38,63,.08)] backdrop-blur-xl lg:hidden"
      >
        {primary.slice(0, 4).map(tabLink)}
        <button
          type="button"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((value) => !value)}
          className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 py-1 transition-colors ${
            moreOpen ? 'text-primary-container' : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <Icon icon={moreOpen ? 'close' : 'menu'} size={24} />
          <span className="text-label-md uppercase tracking-wider">More</span>
          <span className="h-1 w-5 rounded-full bg-transparent" aria-hidden />
        </button>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <button aria-label="Close navigation" onClick={() => setMoreOpen(false)} className="absolute inset-0 bg-primary/40 backdrop-blur-[2px]" />
          <section
            role="dialog"
            aria-modal="true"
            aria-label="All features"
            className="absolute inset-x-0 bottom-0 max-h-[82dvh] overflow-y-auto rounded-t-2xl bg-surface-container-lowest px-5 pt-3 pb-[calc(5rem+env(safe-area-inset-bottom))] shadow-2xl"
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
            <div className="grid grid-cols-2 gap-2">
              {[...primary, ...secondary.filter((item) => !primary.some((main) => main.href === item.href))].map((item) => {
                const selected = active(item);
                return (
                  <Link
                    key={`more-${item.href}-${item.label}`}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={`flex min-h-[68px] items-center gap-3 rounded-xl border p-3 text-label-lg ${
                      selected ? 'border-primary-container bg-primary-container text-on-primary' : 'border-outline-variant bg-surface-container-lowest text-on-surface'
                    }`}
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${selected ? 'bg-primary/40' : 'bg-surface-container text-primary-container'}`}>
                      <Icon icon={item.icon} size={20} />
                    </span>
                    <span className="min-w-0 truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
            <div className="mt-4 flex items-center justify-between rounded-xl bg-surface-container-low p-3">
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
