'use client';

import React from 'react';
import { useAuth } from '@/lib/auth/authContext';
import { Icon } from '@/components/ui/Icon';

/**
 * The navy command bar shown on every signed-in screen. It carries identity and
 * orientation, not navigation. Solid navy with light text keeps it clearly
 * separate from the pale content below, so a first-time operator always knows
 * "this is the top of the app" and can spot their own name and role.
 */
export function Header({ title, subtitle }: { title?: string; subtitle?: string }) {
  const { user, role } = useAuth();

  const todayStr = new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date());

  const initials = user?.full_name ? user.full_name.trim().charAt(0).toUpperCase() : '';
  const roleLabel = role === 'admin' ? 'Administrator' : role === 'home_guard' ? 'Home Guard' : 'Division Incharge';

  return (
    <header className="sticky top-0 z-40 bg-primary pt-safe text-on-primary shadow-[0_2px_10px_rgba(0,17,38,.18)]">
      <div className="mx-auto flex min-h-16 w-full max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-7 lg:px-10">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-container text-secondary-container ring-1 ring-white/10">
            <Icon icon="local_police" size={24} />
          </span>
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-[16px] font-bold tracking-tight">TN Home Guards</span>
            <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-primary-fixed-dim">
              <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-tertiary-fixed" />
              <span className="truncate">{subtitle || title || roleLabel}</span>
              <span className="hidden shrink-0 text-[13px] text-on-primary-container sm:inline">· {todayStr}</span>
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          {user?.personnel_id && (
            <span className="hidden rounded-lg bg-primary-container px-2.5 py-1 font-mono text-[13px] text-primary-fixed sm:inline">
              {user.personnel_id}
            </span>
          )}
          <span
            className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary-container text-[16px] font-bold text-on-secondary-container"
            aria-label={`${user?.full_name || 'Account'} — ${roleLabel}`}
            title={user?.full_name || 'Account'}
          >
            {initials || <Icon icon="person" size={20} />}
          </span>
        </div>
      </div>
    </header>
  );
}
