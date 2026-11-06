'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { loadAttendanceEvents, loadAttendancePage, type AttendanceDivision, type AttendanceEventSummary } from '@/lib/services/simpleAttendanceService';

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonth(month: string) {
  const [y, m] = month.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, 1);
  if (Number.isNaN(dt.getTime())) return month;
  return dt.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function formatDay(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return date;
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function EventCard({ event }: { event: AttendanceEventSummary }) {
  const presentPct = event.sanctionedCount ? Math.round((event.presentCount / event.sanctionedCount) * 100) : 0;
  const absentPct = event.sanctionedCount ? Math.round((event.absentCount / event.sanctionedCount) * 100) : 0;
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-3.5 shadow-card transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-label-sm uppercase tracking-wide text-secondary">
            <Icon icon="shield" size={15} />
            <span className="truncate">{event.divisionName} Division</span>
          </div>
          <h2 className="mt-0.5 truncate text-headline-sm text-primary">{formatDay(event.date)} Muster</h2>
          <div className="mt-0.5 flex items-center gap-1.5 text-label-sm text-on-surface-variant">
            <Icon icon="schedule" size={14} />
            <span>{formatDay(event.date)}</span>
          </div>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded px-2 py-0.5 text-label-sm uppercase tracking-wider ${
            event.isOpen ? 'bg-secondary-fixed text-on-secondary-fixed-variant' : 'bg-surface-container-highest text-on-surface'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${event.isOpen ? 'bg-secondary' : 'bg-outline'}`} aria-hidden />
          {event.isOpen ? 'Muster open' : 'Muster closed'}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 rounded bg-surface-container-low p-2">
        <div className="flex flex-col">
          <span className="text-label-sm text-on-surface-variant">Present</span>
          <div className="mt-0.5 flex items-baseline gap-1">
            <span className="text-headline-sm tabular-nums text-on-tertiary-container">{event.presentCount}</span>
            <span className="text-label-sm font-bold text-on-tertiary-container">{presentPct}%</span>
          </div>
          <span className="text-xs text-on-surface-variant">On duty</span>
        </div>
        <div className="flex flex-col">
          <span className="text-label-sm text-on-surface-variant">Absent</span>
          <div className="mt-0.5 flex items-baseline gap-1">
            <span className="text-headline-sm tabular-nums text-error">{event.absentCount}</span>
            <span className="text-label-sm font-bold text-error">{absentPct}%</span>
          </div>
          <span className="text-xs text-on-surface-variant">Unaccounted</span>
        </div>
        <div className="flex flex-col">
          <span className="text-label-sm text-on-surface-variant">Sanctioned</span>
          <div className="mt-0.5 flex items-baseline gap-1">
            <span className="text-headline-sm tabular-nums text-primary">{event.sanctionedCount}</span>
          </div>
          <span className="text-xs text-on-surface-variant">Guards</span>
        </div>
      </div>

      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high">
        <span className="h-full bg-tertiary-fixed-dim" style={{ width: `${presentPct}%` }} />
        <span className="h-full bg-error" style={{ width: `${absentPct}%` }} />
      </div>

      <Link
        href={`/admin/events/${event.id}`}
        className="mt-0.5 flex items-center justify-between rounded bg-primary px-3 py-2.5 text-label-lg text-on-primary shadow-sm transition-colors active:bg-primary-container"
      >
        <span className="flex items-center gap-2">
          <Icon icon="visibility" size={18} className="text-secondary-container" />
          <span>View attendance record</span>
        </span>
        <Icon icon="arrow_forward" size={20} />
      </Link>
    </article>
  );
}

export function AttendanceEvents() {
  const [month, setMonth] = useState(currentMonth);
  const [divisionId, setDivisionId] = useState<string | null>(null);
  const [divisions, setDivisions] = useState<AttendanceDivision[]>([]);
  const [events, setEvents] = useState<AttendanceEventSummary[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAttendancePage('', currentMonth() + '-01')
      .then((data) => setDivisions(data.divisions))
      .catch(() => setDivisions([]));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    loadAttendanceEvents(month, divisionId)
      .then(setEvents)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not load attendance events.'))
      .finally(() => setLoading(false));
  }, [month, divisionId]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return events;
    return events.filter((event) => `${event.divisionName} ${formatDay(event.date)}`.toLowerCase().includes(term));
  }, [events, search]);

  return (
    <div className="mx-auto max-w-2xl space-y-0">
      {/* Institutional banner with search. */}
      <section className="rounded-b-xl bg-primary-container px-4 pb-4 pt-3 text-on-primary">
        <div className="mb-1 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-secondary-container" aria-hidden />
            <span className="text-label-sm uppercase tracking-widest text-secondary-fixed">Muster Administration</span>
          </div>
          <span className="rounded bg-primary px-2 py-0.5 font-mono text-xs text-on-primary-container">DIST-TPR-ADM</span>
        </div>
        <h1 className="text-headline-md tracking-tight text-on-primary">Events</h1>
        <p className="text-label-md leading-snug text-on-primary-container">Tiruppur District Daily Muster Records</p>
        <div className="relative mt-3">
          <Icon icon="search" size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-primary-container" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by division or date..."
            aria-label="Search events"
            className="w-full rounded bg-primary py-2.5 pl-9 pr-3 text-label-lg text-on-primary shadow-inner ring-secondary-container placeholder:text-on-primary-container/70 focus:outline-none focus:ring-2"
          />
        </div>
      </section>

      {/* Month control + division filter pills. */}
      <section className="flex flex-col gap-2 rounded-lg bg-surface-container-high px-4 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <label className="inline-flex items-center gap-1.5 rounded bg-surface-container-lowest px-3 py-1.5 text-label-md text-primary shadow-sm">
            <Icon icon="calendar_month" size={18} className="text-secondary" />
            <span>{formatMonth(month)}</span>
            <input
              type="month"
              value={month}
              onChange={(event) => event.target.value && setMonth(event.target.value)}
              aria-label="Choose a month"
              className="absolute h-0 w-0 opacity-0"
            />
          </label>
          <div className="flex items-center gap-1.5 rounded bg-surface-container-lowest px-2.5 py-1 text-label-sm text-on-surface-variant shadow-sm">
            <Icon icon="folder_special" size={15} className="text-on-tertiary-container" />
            <span className="font-mono font-bold text-on-surface">{events.length}</span>
            <span>Total Events Logged</span>
          </div>
        </div>
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto py-0.5">
          <button
            type="button"
            onClick={() => setDivisionId(null)}
            className={`flex shrink-0 items-center gap-1.5 rounded px-3 py-1.5 text-label-md shadow-sm ${
              divisionId === null ? 'bg-primary-container text-on-primary' : 'bg-surface-container-lowest text-on-surface-variant hover:text-primary'
            }`}
          >
            {divisionId === null && <span className="h-1.5 w-1.5 rounded-full bg-secondary-container" aria-hidden />}
            All Divisions
          </button>
          {divisions.map((division) => (
            <button
              key={division.id}
              type="button"
              onClick={() => setDivisionId(division.id)}
              className={`shrink-0 rounded px-3 py-1.5 text-label-md shadow-sm ${
                divisionId === division.id ? 'bg-primary-container text-on-primary' : 'bg-surface-container-lowest text-on-surface-variant hover:text-primary'
              }`}
            >
              {division.name}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3.5 py-1">
        {error ? (
          <div role="alert" className="flex items-start gap-2.5 rounded-lg bg-error-container p-3 text-on-error-container">
            <Icon icon="error" size={20} fill className="mt-0.5 shrink-0 text-error" />
            <div className="min-w-0 flex-1 text-sm">
              <p>{error}</p>
              <button type="button" onClick={load} className="mt-1 font-bold underline">Try again</button>
            </div>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-on-surface-variant">
            <Icon icon="sync" size={20} className="animate-spin" />
            Loading muster records…
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-10 text-center shadow-card">
            <Icon icon="event_note" size={32} className="mx-auto text-outline" />
            <h4 className="mt-3 text-headline-sm text-on-surface">No muster records this month</h4>
            <p className="mt-1 text-body-md text-sm text-on-surface-variant">
              {search ? 'No events match that search.' : 'Attendance marked by incharges will appear here.'}
            </p>
          </div>
        ) : (
          visible.map((event) => <EventCard key={event.id} event={event} />)
        )}

        <div className="flex items-center justify-center gap-2 py-3 text-center text-on-surface-variant/80">
          <Icon icon="verified_user" size={16} className="text-secondary" />
          <span className="text-label-sm">Authorized for Official Review • TN Police Dept</span>
        </div>
      </section>
    </div>
  );
}
