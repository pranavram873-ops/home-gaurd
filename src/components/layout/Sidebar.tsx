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
        // Profiles" on mobile where there is no rail.
        { label: 'Events', href: '/admin/dashboard', icon: 'event_note' },
        { label: 'Profiles', href: '/admin/personnel', icon: 'groups' },
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
  const moreItems: Item[] = admin
    ? [
        { label: 'Change district', href: '/admin/divisions', icon: 'domain' },
        { label: 'Create account', href: '/register', icon: 'person_add' },
      ]
    : role === 'incharge'
      ? [{ label: 'Change district', href: '/incharge/divisions', icon: 'domain' }]
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
        className={`group press-scale flex items-center gap-3 rounded-xl px-3 py-3 text-[14px] transition-all duration-200 ${
          selected ? 'bg-primary-container font-bold text-on-primary shadow-sm shadow-primary/15' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
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
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[276px] flex-col border-r border-outline-variant/70 bg-surface-container-low text-on-surface lg:flex">
        <div className="flex items-center gap-3 border-b border-outline-variant/70 px-6 py-6">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-container text-on-primary shadow-sm">
            <Icon icon="local_police" size={22} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[16px] font-bold tracking-tight text-on-surface">TN Home Guards</p>
            <p className="truncate text-[13px] text-on-surface-variant">Field operations</p>
          </div>
        </div>

        <div className="px-4 pt-5">
          <p className="px-3 pb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">Workspace</p>
          <nav className="flex flex-col gap-1.5">{primary.map(railLink)}</nav>
        </div>
        <div className="mt-auto border-t border-outline-variant/70 p-4">
          <button
            type="button"
            aria-expanded={moreOpen}
            aria-label="More options"
            onClick={() => setMoreOpen((value) => !value)}
            className={`flex h-11 w-full items-center gap-3 rounded-xl px-3 text-label-md transition-colors ${moreOpen ? 'bg-primary-container text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'}`}
          >
            <Icon icon={moreOpen ? 'close' : 'menu'} size={20} />
            More
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
        <div className="fixed inset-0 z-[60]">
          <button aria-label="Close navigation" data-open={moreMenu.visible} onClick={() => setMoreOpen(false)} className="sheet-scrim" />
          <section
            role="dialog"
            aria-modal="true"
            aria-label="More"
            data-open={moreMenu.visible}
            className="sheet-panel sheet-from-bottom absolute inset-x-0 bottom-0 max-h-[82dvh] overflow-y-auto rounded-t-2xl bg-surface-container-lowest px-5 pt-3 pb-[calc(5rem+env(safe-area-inset-bottom))] shadow-2xl sm:max-w-none lg:inset-x-auto lg:bottom-5 lg:left-[280px] lg:max-h-[min(82vh,680px)] lg:w-[340px] lg:rounded-2xl lg:px-5 lg:pb-5"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-outline-variant" aria-hidden />
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-headline-md text-on-surface">More</p>
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
            <div className="mb-4 flex items-center gap-3 rounded-xl bg-surface-container-low p-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-container text-lg font-bold text-on-primary shadow-xs">
                {user?.full_name?.charAt(0).toUpperCase() || <Icon icon="person" size={20} />}
              </span>
              <div className="min-w-0">
                <p className="truncate text-label-lg text-on-surface">{user?.full_name || 'Signed in'}</p>
                <p className="truncate text-xs text-on-surface-variant">
                  {admin ? 'Administrator' : role === 'home_guard' ? 'Home Guard' : 'Incharge'}
                  {user?.personnel_id ? ` · ${user.personnel_id}` : ''}
                </p>
              </div>
            </div>
            <nav aria-label="More options" className="mb-4 flex flex-col gap-1">
              {moreItems.map((item) => (
                <Link key={item.href} href={item.href} onClick={() => setMoreOpen(false)} className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-label-md text-on-surface transition-colors hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary">
                  <Icon icon={item.icon} size={20} className="text-primary" />
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
            <div className="border-t border-outline-variant/60 pt-4">
              <button
                onClick={() => void logout()}
                className="flex h-11 w-full items-center gap-2 rounded-xl px-3 text-label-md text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface focus-visible:outline-2 focus-visible:outline-primary"
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
