'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { loadGuardDutyHistory, loadGuardMemoCount, type GuardDutyHistory } from '@/lib/services/simpleAttendanceService';
import { createClient } from '@/lib/supabase/client';
import { GuardPersonnelMemos } from '@/components/attendance/GuardPersonnelMemos';
import { useAuth } from '@/lib/auth/authContext';

type GuardProfile = {
  id: string;
  full_name: string;
  phone: string;
  home_guard_code: string;
  division_name: string;
  division_id: string;
  date_of_birth: string | null;
  joining_date: string | null;
};

function formatProfileDate(date: string | null | undefined) {
  if (!date) return 'Not provided';
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function HomeGuardProfileLink({
  code,
  name,
  children,
  className,
}: {
  code: string | null | undefined;
  name: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const [profile, setProfile] = useState<GuardProfile | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function showProfile() {
    if (!code) return;
    setLoading(true);
    setError('');
    try {
      const supabase = createClient();
      const { data: guard, error: guardError } = await supabase
        .from('home_guard_roster')
        .select('id, full_name, phone, home_guard_code, division_id, date_of_birth, joining_date')
        .eq('home_guard_code', code)
        .maybeSingle();
      if (guardError) throw new Error(guardError.message);
      if (!guard) throw new Error('This Home Guard is not in the active division roster.');

      const { data: division } = await supabase
        .from('attendance_divisions')
        .select('name')
        .eq('id', guard.division_id)
        .maybeSingle();
      setProfile({ ...guard, division_name: division?.name ?? 'Division not available' });
      setOpen(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load this Home Guard profile.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {code ? (
        <button type="button" onClick={() => void showProfile()} disabled={loading} className={className}>
          {loading ? 'Loading profile…' : children ?? name}
        </button>
      ) : <span className={className}>{children ?? name}</span>}
      {error && (
        <span role="alert" className="ml-2 text-xs text-on-error-container">{error}</span>
      )}
      {open && profile && createPortal(
        <HomeGuardProfileDialog profile={profile} onClose={() => setOpen(false)} />,
        document.body,
      )}
    </>
  );
}

function HomeGuardProfileDialog({ profile, onClose }: { profile: GuardProfile; onClose: () => void }) {
  const { role } = useAuth();
  const [history, setHistory] = useState<GuardDutyHistory | null>(null);
  const [memoCount, setMemoCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [eventsOpen, setEventsOpen] = useState(false);

  useEffect(() => {
    let live = true;
    Promise.all([
      loadGuardDutyHistory(profile.phone),
      loadGuardMemoCount(profile.id, profile.phone),
    ]).then(([dutyHistory, memos]) => {
      if (!live) return;
      setHistory(dutyHistory);
      setMemoCount(memos);
    }).catch(() => {
      if (live) setHistory(null);
    }).finally(() => {
      if (live) setLoading(false);
    });
    return () => { live = false; };
  }, [profile]);

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const eventsThisMonth = history?.events.filter((event) => event.date.startsWith(currentMonth)) ?? [];

  return (
    <div className="overlay-enter fixed inset-0 z-[70] flex items-center justify-center bg-surface-container/50 p-4 backdrop-blur-xs" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="home-guard-profile-title" className="overlay-panel flex max-h-[92dvh] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-2xl">
        <header className="flex shrink-0 items-center justify-between bg-primary p-4 text-on-primary">
          <div className="flex items-center gap-2"><Icon icon="badge" size={20} /><h2 id="home-guard-profile-title" className="font-bold">Home Guard Profile</h2></div>
          <button type="button" onClick={onClose} aria-label="Close profile" className="rounded p-1 hover:bg-white/10"><Icon icon="close" size={20} /></button>
        </header>
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto p-4">
          <div className="flex items-center gap-3 rounded-xl bg-surface-container-low p-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-extrabold text-on-primary">{profile.full_name.charAt(0)}</div>
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold text-on-surface">{profile.full_name}</h3>
              <p className="font-mono text-xs font-bold text-primary">{profile.home_guard_code}</p>
            </div>
          </div>
          <div className="grid w-full grid-cols-2 gap-2">
            <div className="rounded-lg bg-surface-container-low p-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Division</p>
              <p className="mt-0.5 truncate text-sm font-semibold text-primary">{profile.division_name} Division</p>
            </div>
            <div className="rounded-lg bg-surface-container-low p-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Mobile</p>
              <p className="mt-0.5 truncate text-sm font-semibold text-on-surface">{profile.phone || 'Not provided'}</p>
            </div>
            <div className="rounded-lg bg-surface-container-low p-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Date of birth</p>
              <p className="mt-0.5 text-sm font-semibold text-on-surface">{formatProfileDate(profile.date_of_birth)}</p>
            </div>
            <div className="rounded-lg bg-surface-container-low p-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Joining date</p>
              <p className="mt-0.5 text-sm font-semibold text-on-surface">{formatProfileDate(profile.joining_date)}</p>
            </div>
          </div>
          <div className="grid w-full grid-cols-2 gap-3">
            <div className="rounded-xl bg-surface-container-low p-3">
              <p className="text-xs font-semibold text-on-surface-variant">Duties this month</p>
              <p className="mt-1 text-xl font-extrabold text-primary">{loading ? '…' : history?.months[0]?.present ?? 0}</p>
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={() => setEventsOpen(true)}
                className="mt-2 flex min-h-9 w-full items-center justify-between gap-1 rounded-md text-left text-xs font-semibold text-primary hover:underline"
              >
                <span>View events this month</span>
                <Icon icon="chevron_right" size={18} />
              </button>
            </div>
            <div className="rounded-xl bg-surface-container-low p-3">
              <p className="text-xs font-semibold text-on-surface-variant">Memos on file</p>
              <p className="mt-1 text-xl font-extrabold text-primary">{loading ? '…' : memoCount ?? 0}</p>
              <GuardPersonnelMemos guardId={profile.id} onNavigate={onClose} />
            </div>
          </div>
          <button type="button" onClick={onClose} className="min-h-11 w-full rounded-lg bg-surface-container text-label-md font-semibold text-on-surface-variant hover:bg-surface-container-high">Close</button>
        </div>
      </section>
      {eventsOpen && createPortal(
        <div
          className="overlay-enter fixed inset-0 z-[90] flex items-center justify-center bg-surface-container/50 p-4 backdrop-blur-xs"
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setEventsOpen(false); }}
        >
          <section role="dialog" aria-modal="true" aria-labelledby="home-guard-events-title" className="overlay-panel flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-2xl">
            <header className="flex shrink-0 items-center justify-between bg-primary p-4 text-on-primary">
              <h2 id="home-guard-events-title" className="font-bold">Events this month</h2>
              <button type="button" onClick={() => setEventsOpen(false)} aria-label="Close event list" className="rounded p-1 hover:bg-white/10">
                <Icon icon="close" size={20} />
              </button>
            </header>
            <div className="min-h-24 overflow-y-auto overscroll-contain p-4">
              {loading ? (
                <p className="text-sm text-on-surface-variant">Loading events…</p>
              ) : !history ? (
                <p className="text-sm text-on-surface-variant">Event history is unavailable.</p>
              ) : eventsThisMonth.length ? (
                <ul className="divide-y divide-outline-variant">
                  {eventsThisMonth.map((event) => {
                    const eventName = event.eventName || 'Muster event';
                    const href = role === 'admin'
                      ? `/admin/events/${history.divisionId}.${event.date}${event.eventId ? `.${event.eventId}` : ''}`
                      : role === 'incharge'
                        ? `/incharge/attendance?date=${encodeURIComponent(event.date)}&division=${encodeURIComponent(history.divisionId)}${event.eventId ? `&eventId=${encodeURIComponent(event.eventId)}` : `&event=${encodeURIComponent(eventName)}`}`
                        : null;

                    return (
                      <li key={`${event.date}-${event.eventId ?? 'legacy'}`} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                        <div className="min-w-0">
                          {href ? (
                            <Link href={href} onClick={onClose} className="block truncate text-sm font-semibold text-primary underline underline-offset-2 hover:text-primary/80">
                              {eventName}
                            </Link>
                          ) : (
                            <p className="truncate text-sm font-semibold text-on-surface">{eventName}</p>
                          )}
                          <p className="text-xs text-on-surface-variant">{formatProfileDate(event.date)}</p>
                        </div>
                        <span className={`shrink-0 text-xs font-semibold ${event.status === 'present' ? 'text-on-tertiary-container' : 'text-error'}`}>
                          {event.status}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-on-surface-variant">No events recorded this month.</p>
              )}
            </div>
            <footer className="shrink-0 border-t border-outline-variant p-3">
              <button type="button" onClick={() => setEventsOpen(false)} className="min-h-10 w-full rounded-lg bg-surface-container text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high">
                Close
              </button>
            </footer>
          </section>
        </div>,
        document.body,
      )}
    </div>
  );
}
