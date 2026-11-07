'use client';

import React from 'react';
import { useAuth } from '@/lib/auth/authContext';
import { Icon } from '@/components/ui/Icon';

/**
 * The command bar shown on every signed-in screen. It carries identity and
 * orientation, not navigation. A royal blue bar keyed to the Home Guards crest
 * keeps it clearly separate from the content below, so a first-time operator
 * always knows "this is the top of the app" and can spot their own name and
 * role.
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
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[linear-gradient(110deg,#102a43_0%,#24598a_100%)] pt-safe text-on-primary shadow-[0_5px_18px_rgba(16,42,67,.16)] backdrop-blur-xl">
      <div className="relative mx-auto flex min-h-16 w-full max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-7 lg:px-10">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-secondary-container ring-1 ring-white/15">
            <Icon icon="local_police" size={24} />
          </span>
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-[16px] font-bold tracking-tight">TN Home Guards</span>
            <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-primary-fixed/70">
              <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-tertiary-fixed shadow-[0_0_8px_rgba(217,247,232,.8)]" />
              <span className="truncate">{subtitle || title || roleLabel}</span>
              <span className="hidden shrink-0 text-[13px] text-primary-fixed/50 sm:inline">· {todayStr}</span>
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          {user?.personnel_id && (
            <span className="hidden rounded-lg bg-white/[0.08] px-2.5 py-1 font-mono text-[13px] text-primary-fixed ring-1 ring-white/10 sm:inline">
              {user.personnel_id}
            </span>
          )}
          <span
            className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary-container text-[16px] font-bold text-on-secondary-container shadow-[0_0_12px_rgba(189,39,53,.16)]"
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
