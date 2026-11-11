'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { deleteMusterEvent, loadAttendanceEvents, saveMusterEvent, type AttendanceEventSummary } from '@/lib/services/simpleAttendanceService';
import { useDivision } from '@/lib/attendance/divisionContext';
import { useAuth } from '@/lib/auth/authContext';
import { EventDeleteDialog } from '@/components/attendance/EventDeleteDialog';

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - index);
  const monthValue = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  return {
    value: monthValue,
    label: date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
  };
});

function formatDay(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return date;
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function EventCard({ event, canDelete, forIncharge, onDelete }: { event: AttendanceEventSummary; canDelete: boolean; forIncharge: boolean; onDelete: (event: AttendanceEventSummary) => void }) {
  const presentPct = event.sanctionedCount ? Math.round((event.presentCount / event.sanctionedCount) * 100) : 0;
  const absentPct = event.sanctionedCount ? Math.round((event.absentCount / event.sanctionedCount) * 100) : 0;
  return (
    <article className="card-hover-lift flex flex-col gap-3 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-3.5 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-label-sm uppercase tracking-wide text-secondary">
            <Icon icon="shield" size={15} />
            <span className="truncate">{event.divisionName} Division</span>
          </div>
          <h2 className="mt-0.5 truncate text-headline-sm text-primary">{event.eventName || `${formatDay(event.date)} Muster`}</h2>
          <div className="mt-0.5 flex items-center gap-1.5 text-label-sm text-on-surface-variant">
            <Icon icon="schedule" size={14} />
            <span>{formatDay(event.date)}</span>
          </div>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded px-2 py-0.5 text-label-sm uppercase tracking-wider transition-colors duration-200 ${
            event.isOpen ? 'bg-secondary-fixed text-on-secondary-fixed-variant' : 'bg-surface-container-highest text-on-surface'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${event.isOpen ? 'beacon-pulse-red bg-secondary' : 'bg-outline'}`} aria-hidden />
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
        <span className="h-full bg-tertiary-fixed-dim transition-all duration-700 ease-out" style={{ width: `${presentPct}%` }} />
        <span className="h-full bg-error transition-all duration-700 ease-out" style={{ width: `${absentPct}%` }} />
      </div>

      <Link
        href={forIncharge ? `/incharge/attendance?date=${encodeURIComponent(event.date)}&division=${encodeURIComponent(event.divisionId)}&event=${encodeURIComponent(event.eventName ?? '')}` : `/admin/events/${event.id}`}
        className="group mt-0.5 flex items-center justify-between rounded bg-primary px-3 py-2.5 text-label-lg text-on-primary shadow-sm transition-all duration-200 hover:bg-primary-container active:scale-[0.98]"
      >
        <span className="flex items-center gap-2">
          <Icon icon="visibility" size={18} className="text-on-secondary-container transition-transform duration-200 group-hover:scale-110" />
          <span>View attendance record</span>
        </span>
        <Icon icon="arrow_forward" size={20} className="transition-transform duration-200 group-hover:translate-x-0.5" />
      </Link>
      {canDelete && (
        <button type="button" onClick={() => onDelete(event)} className="flex min-h-10 items-center justify-center gap-2 rounded-lg bg-error-container px-3 text-sm font-bold text-on-error-container hover:bg-error-container/80">
          <Icon icon="delete" size={18} /> Delete event
        </button>
      )}
    </article>
  );
}

export function AttendanceEvents({ forIncharge = false }: { forIncharge?: boolean }) {
  const { divisionId } = useDivision();
  const { role } = useAuth();
  const [month, setMonth] = useState(currentMonth);
  const [events, setEvents] = useState<AttendanceEventSummary[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [eventAddress, setEventAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [eventToDelete, setEventToDelete] = useState<AttendanceEventSummary | null>(null);
  const canCreate = role === 'admin' || role === 'incharge';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setEvents(await loadAttendanceEvents(month, divisionId || null));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load attendance events.');
    } finally {
      setLoading(false);
    }
  }, [month, divisionId]);

  useEffect(() => {
    load();
  }, [load]);

  async function createEvent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!divisionId || !eventName.trim()) return;
    setSaving(true);
    setError('');
    try {
      await saveMusterEvent(divisionId, eventDate, eventName, eventAddress);
      setShowCreate(false);
      setEventName('');
      setEventAddress('');
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create the event.');
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(event: AttendanceEventSummary) {
    setError('');
    setEventToDelete(event);
  }

  async function confirmDelete() {
    if (!eventToDelete) return;
    const event = eventToDelete;
    setDeletingId(event.id);
    setError('');
    try {
      await deleteMusterEvent(event.divisionId, event.date);
      setEvents((current) => current.filter((item) => item.id !== event.id));
      setEventToDelete(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete the event.');
    } finally {
      setDeletingId('');
    }
  }

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return events;
    return events.filter((event) => `${event.divisionName} ${event.eventName ?? ''} ${formatDay(event.date)}`.toLowerCase().includes(term));
  }, [events, search]);

  return (
    <div className="mx-auto max-w-2xl space-y-0">
      {/* Institutional banner with search. */}
      <section className="rounded-b-xl bg-primary-container px-4 pb-4 pt-3 text-on-primary">
        <div className="mb-1 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-on-secondary-container" aria-hidden />
            <span className="text-label-sm uppercase tracking-widest text-on-primary-container">Muster Administration</span>
          </div>
          <span className="rounded bg-primary px-2 py-0.5 font-mono text-xs text-on-primary-container">DIST-TPR-ADM</span>
        </div>
        <h1 className="text-headline-md tracking-tight text-on-primary">Events</h1>
        <p className="text-label-md leading-snug text-on-primary-container">
          {divisionId ? 'Selected district · event and muster records' : 'All districts · event and muster records'}
        </p>
        <div className="relative mt-3">
          <Icon icon="search" size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-primary-container" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by event, division or date..."
            aria-label="Search events"
            className="w-full rounded bg-primary py-2.5 pl-9 pr-3 text-label-lg text-on-primary shadow-inner ring-on-primary-container/40 placeholder:text-on-primary-container/70 focus:outline-none focus:ring-2"
          />
        </div>
        {canCreate && (
          <button type="button" onClick={() => setShowCreate((current) => !current)} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-primary shadow-sm">
            <Icon icon="add" size={18} /> Create event
          </button>
        )}
      </section>

      {showCreate && canCreate && (
        <form onSubmit={(event) => void createEvent(event)} className="space-y-3 rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-headline-sm text-primary">New event</h2>
            <button type="button" onClick={() => setShowCreate(false)} aria-label="Close event form" className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container hover:text-on-surface">
              <Icon icon="close" size={20} />
            </button>
          </div>
          <label className="block text-label-md text-on-surface">Event name<input required minLength={2} maxLength={140} value={eventName} onChange={(event) => setEventName(event.target.value)} className="mt-1 block h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm" /></label>
          <label className="block text-label-md text-on-surface">Date<input required type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} className="mt-1 block h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm" /></label>
          <label className="block text-label-md text-on-surface">Location<input value={eventAddress} onChange={(event) => setEventAddress(event.target.value)} maxLength={300} className="mt-1 block h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm" /></label>
          {!divisionId && <p role="alert" className="text-sm text-error">Select a division before creating an event.</p>}
          <button type="submit" disabled={saving || !divisionId} className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-on-primary disabled:opacity-50">{saving ? 'Saving…' : 'Save event'}</button>
        </form>
      )}

      {/* Month control + division filter pills. */}
      <section className="flex flex-col gap-2 rounded-[20px] border border-[#e7edf4] bg-[#f8fbfd] px-4 py-2.5 shadow-[0_10px_20px_rgba(17,38,67,0.04)]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex w-full min-w-0 items-center gap-2 rounded-2xl border border-[#dfe7ef] bg-white px-3 py-2.5 text-primary shadow-sm sm:w-auto">
            <Icon icon="calendar_month" size={18} className="shrink-0 text-[#24598a]" />
            <select
              value={month}
              onChange={(event) => event.target.value && setMonth(event.target.value)}
              aria-label="Choose a month"
              className="w-full min-w-0 bg-transparent pr-6 text-sm font-semibold text-[#102a43] outline-none sm:text-label-md"
            >
              {MONTH_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-[#e0e8ee] bg-white px-2.5 py-2 text-[11px] text-[#526372] shadow-sm sm:w-auto sm:justify-start sm:text-label-sm">
            <Icon icon="folder_special" size={15} className="shrink-0 text-[#1d7a5a]" />
            <span className="font-mono font-bold text-[#102a43]">{events.length}</span>
            <span className="whitespace-nowrap">Total records</span>
          </div>
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
          <div className="empty-enter rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-10 text-center shadow-card">
            <Icon icon="event_note" size={32} className="mx-auto text-outline" />
            <h4 className="mt-3 text-headline-sm text-on-surface">No muster records this month</h4>
            <p className="mt-1 text-body-md text-sm text-on-surface-variant">
              {search ? 'No events match that search.' : 'Attendance marked by incharges will appear here.'}
            </p>
          </div>
        ) : (
          <div className="stagger-in flex flex-col gap-3.5">
            {visible.map((event) => (
              <EventCard key={event.id} event={event} forIncharge={forIncharge} canDelete={role === 'admin' && deletingId !== event.id} onDelete={handleDelete} />
            ))}
          </div>
        )}

        <div className="flex items-center justify-center gap-2 py-3 text-center text-on-surface-variant/80">
          <Icon icon="verified_user" size={16} className="text-secondary" />
          <span className="text-label-sm">Authorized for Official Review • TN Police Dept</span>
        </div>
      </section>
      {eventToDelete && <EventDeleteDialog
        title={`Delete “${eventToDelete.eventName || `${formatDay(eventToDelete.date)} Muster`}”?`}
        description={`This will permanently remove the event in ${eventToDelete.divisionName}, its selected personnel, and all attendance recorded for that division and date.`}
        deleting={deletingId === eventToDelete.id}
        error={error || undefined}
        onCancel={() => setEventToDelete(null)}
        onConfirm={() => void confirmDelete()}
      />}
    </div>
  );
}
