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
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-outline-variant/50 bg-surface-container-lowest p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-secondary">
            <Icon icon="shield" size={15} />
            <span className="truncate">{event.divisionName} Division</span>
          </div>
          <h2 className="mt-0.5 truncate text-lg font-semibold text-primary">{event.eventName || `${formatDay(event.date)} Muster`}</h2>
          <div className="mt-1 flex items-center gap-1.5 text-sm text-on-surface-variant">
            <Icon icon="schedule" size={14} />
            <span>{formatDay(event.date)}</span>
          </div>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold uppercase tracking-wide ${event.isOpen ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-surface-container-high text-on-surface-variant'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${event.isOpen ? 'bg-tertiary' : 'bg-outline'}`} aria-hidden />
          {event.isOpen ? 'Open' : 'Closed'}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-xl bg-surface-container-low p-3">
        <div><span className="block text-xs font-medium text-on-surface-variant">Present</span><span className="mt-0.5 block text-xl font-semibold tabular-nums text-on-tertiary-container">{event.presentCount}</span></div>
        <div><span className="block text-xs font-medium text-on-surface-variant">Absent</span><span className="mt-0.5 block text-xl font-semibold tabular-nums text-error">{event.absentCount}</span></div>
        <div><span className="block text-xs font-medium text-on-surface-variant">Guards</span><span className="mt-0.5 block text-xl font-semibold tabular-nums text-primary">{event.sanctionedCount}</span></div>
      </div>

      <Link
        href={forIncharge ? `/incharge/attendance?date=${encodeURIComponent(event.date)}&division=${encodeURIComponent(event.divisionId)}&event=${encodeURIComponent(event.eventName ?? '')}` : `/admin/events/${event.id}`}
        className="group flex min-h-11 items-center justify-between rounded-lg bg-primary px-3 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container"
      >
        <span className="flex items-center gap-2">
          <Icon icon="visibility" size={18} />
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
    <div className="mx-auto max-w-3xl space-y-3">
      <section className="rounded-2xl bg-primary-container px-4 py-4 text-on-primary">
        <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
        <p className="mt-1 text-sm text-on-primary-container">{divisionId ? 'Events and attendance in your selected division' : 'Events and attendance across divisions'}</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <label className="relative min-w-0 flex-1">
            <Icon icon="search" size={19} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-primary-container" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search events, divisions, or dates"
              aria-label="Search events"
              className="h-11 w-full rounded-lg bg-primary pl-10 pr-3 text-sm text-on-primary placeholder:text-on-primary-container/80 focus:outline-none focus:ring-2 focus:ring-on-primary-container"
            />
          </label>
          {canCreate && (
            <button type="button" onClick={() => setShowCreate((current) => !current)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-surface-container-lowest px-4 text-sm font-semibold text-primary transition-colors hover:bg-surface-container-low">
              <Icon icon="add" size={18} /> Create event
            </button>
          )}
        </div>
      </section>
      <section className="flex flex-col gap-2 rounded-2xl border border-outline-variant/50 bg-surface-container-low px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex min-h-10 items-center gap-2 text-sm text-on-surface-variant">
            <Icon icon="calendar_month" size={18} className="text-primary" />
            <span className="sr-only">Choose a month</span>
            <select value={month} onChange={(event) => event.target.value && setMonth(event.target.value)} aria-label="Choose a month" className="min-w-0 bg-transparent font-medium text-on-surface outline-none">
              {MONTH_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <span className="text-sm text-on-surface-variant"><strong className="font-semibold tabular-nums text-on-surface">{events.length}</strong> {events.length === 1 ? 'event' : 'events'}</span>
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

      <section className="flex flex-col gap-3.5">
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
          <div className="empty-enter rounded-2xl border border-outline-variant/50 bg-surface-container-lowest p-10 text-center shadow-card">
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
