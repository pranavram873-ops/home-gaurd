'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { Card, EmptyState } from '@/components/ui/primitives';
import { HomeGuardProfileLink } from '@/components/attendance/HomeGuardProfileLink';
import {
  getMusterEventParticipants,
  loadAttendancePage,
  saveDailyMark,
  setMusterEventParticipant,
  type DailyMark,
  type MusterEvent,
  type RosterGuard,
} from '@/lib/services/simpleAttendanceService';

function formatDay(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return date;
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(iso: string) {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase();
}

/**
 * Full-page Home Guard picker for a muster event. Selection is staged locally
 * and committed on Save: selected guards become event participants marked
 * present, guards removed from the event are marked absent, and guards who
 * were never on the event are left untouched.
 */
export function EventPersonnelPicker({
  divisionId,
  date,
  backHref,
}: {
  divisionId: string;
  date: string;
  backHref: string;
}) {
  const router = useRouter();
  const [roster, setRoster] = useState<RosterGuard[]>([]);
  const [marks, setMarks] = useState<DailyMark[]>([]);
  const [musterEvent, setMusterEvent] = useState<MusterEvent | null>(null);
  const [divisionName, setDivisionName] = useState('');
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [draftIds, setDraftIds] = useState<string[]>([]);
  const [draftReady, setDraftReady] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    loadAttendancePage(divisionId, date)
      .then(async (data) => {
        if (!live) return;
        setRoster(data.roster);
        setMarks(data.marks);
        setMusterEvent(data.musterEvent);
        setDivisionName(data.divisions.find((division) => division.id === divisionId)?.name ?? 'Division');
        if (data.musterEvent) {
          const ids = await getMusterEventParticipants(data.musterEvent.id);
          if (!live) return;
          setParticipantIds(ids);
          setDraftIds(ids);
          setDraftReady(true);
        }
      })
      .catch((reason: unknown) => live && setError(reason instanceof Error ? reason.message : 'Could not load this event.'))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [divisionId, date]);

  const markByGuard = useMemo(() => new Map(marks.map((mark) => [mark.guard_id, mark])), [marks]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return roster;
    return roster.filter((guard) => `${guard.full_name} ${guard.home_guard_code} ${guard.phone}`.toLowerCase().includes(term));
  }, [roster, search]);

  function toggleDraft(guard: RosterGuard) {
    setDraftIds((current) =>
      current.includes(guard.id) ? current.filter((id) => id !== guard.id) : [...current, guard.id],
    );
  }

  async function saveSelection() {
    if (!musterEvent) return;
    setSaving(true);
    setError('');
    const desired = new Set(draftIds);
    const current = new Set(participantIds);
    try {
      await Promise.all([
        ...roster
          .filter((guard) => desired.has(guard.id) && !current.has(guard.id))
          .map((guard) => setMusterEventParticipant(musterEvent.id, guard.id, true)),
        ...[...current]
          .filter((id) => !desired.has(id))
          .map((id) => setMusterEventParticipant(musterEvent.id, id, false)),
      ]);

      const markedAt = new Date().toISOString();
      const affected = roster.filter((guard) => desired.has(guard.id) || current.has(guard.id));
      await Promise.all(
        affected
          .filter((guard) => markByGuard.get(guard.id)?.status !== (desired.has(guard.id) ? 'present' : 'absent'))
          .map((guard) => saveDailyMark(guard.id, divisionId, date, desired.has(guard.id) ? 'present' : 'absent')),
      );

      setParticipantIds([...desired]);
      setMarks((existing) => {
        const next = new Map(existing.map((mark) => [mark.guard_id, mark]));
        for (const guard of affected) {
          const want: DailyMark['status'] = desired.has(guard.id) ? 'present' : 'absent';
          const prior = next.get(guard.id);
          if (prior?.status === want) continue;
          next.set(guard.id, {
            id: prior?.id ?? `${guard.id}-${date}`,
            guard_id: guard.id,
            division_id: divisionId,
            attendance_date: date,
            status: want,
            photo_url: prior?.photo_url ?? null,
            marked_at: markedAt,
          });
        }
        return [...next.values()];
      });
      router.push(backHref);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save event personnel.');
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-3 pb-28">
      <Card className="p-3.5 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
              {divisionName} Division · {formatDay(date)}
            </p>
            <h2 className="mt-0.5 truncate text-headline-sm font-bold text-on-surface">
              {musterEvent?.event_name || 'Event personnel'}
            </h2>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary-fixed px-3 py-1.5 text-label-md font-bold text-on-primary-fixed">
            <Icon icon="how_to_reg" size={16} />
            {draftReady ? `${draftIds.length} of ${roster.length} selected` : 'Loading…'}
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
          Selected guards are recorded as <span className="font-bold text-on-tertiary-container">present</span>; guards removed from the event are recorded as <span className="font-bold text-error">absent</span>. Guards who were never on the event are not marked.
        </p>
      </Card>

      {error && (
        <div role="alert" className="alert-enter flex items-start gap-2.5 rounded-lg bg-error-container p-3 text-on-error-container">
          <Icon icon="error" size={18} fill className="mt-0.5 shrink-0 text-error" />
          <span className="min-w-0 flex-1 text-sm">{error}</span>
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="border-b border-outline-variant/60 p-3 sm:p-4">
          <div className="relative w-full">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-on-surface-variant">
              <Icon icon="search" size={20} />
            </span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              type="search"
              aria-label="Search Home Guards"
              placeholder="Search guard by name, HG code or phone..."
              className="h-12 w-full rounded-xl bg-surface-container-lowest pl-10 pr-3 text-label-lg text-on-surface shadow-sm ring-primary-container placeholder:text-outline focus:outline-none focus:ring-2"
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-label-sm font-bold uppercase text-on-surface-variant">Division roster</span>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => setDraftIds(roster.map((guard) => guard.id))} className="rounded-lg px-2.5 py-1.5 text-label-md font-bold text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface">All</button>
              <button type="button" onClick={() => setDraftIds([])} className="rounded-lg px-2.5 py-1.5 text-label-md font-bold text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface">None</button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-on-surface-variant">
            <Icon icon="sync" size={20} className="animate-spin" />
            Loading division personnel…
          </div>
        ) : !musterEvent ? (
          <EmptyState
            icon="event_busy"
            title="No muster event for this date"
            body="Create the event first, then assign Home Guards to it."
          />
        ) : visible.length === 0 ? (
          <EmptyState
            icon="person_search"
            title={roster.length === 0 ? 'No Home Guards in this division' : 'No Home Guards match that search'}
            body={roster.length === 0 ? 'Active Home Guard profiles need a matching attendance roster entry for this division.' : 'Try a different name, code or phone number.'}
          />
        ) : (
          <ul className="stagger-in flex flex-col gap-2 p-3 sm:p-4">
            {visible.map((guard) => {
              const selected = draftIds.includes(guard.id);
              const onEvent = participantIds.includes(guard.id);
              const mark = onEvent ? markByGuard.get(guard.id) : undefined;
              return (
                <li key={guard.id} className="card-hover-lift rounded-xl bg-surface-container-low p-3.5 shadow-sm transition-all duration-200 hover:bg-surface-container/70">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-extrabold shadow-xs ${selected ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'}`}>
                        {initials(guard.full_name)}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <HomeGuardProfileLink code={guard.home_guard_code} name={guard.full_name} className="truncate text-left text-base font-bold text-on-surface transition-colors hover:text-primary hover:underline">
                            {guard.full_name}
                          </HomeGuardProfileLink>
                          {selected && <Icon icon="check_circle" size={16} fill className="shrink-0 text-tertiary" />}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2">
                          <span className="truncate font-mono text-xs font-extrabold tracking-wider text-primary">{guard.home_guard_code}</span>
                          <span className="truncate text-xs text-on-surface-variant">• {guard.phone}</span>
                        </div>
                      </div>
                    </div>
                    {mark?.status === 'present' ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-tertiary-fixed px-2 py-0.5 text-label-sm font-bold text-on-tertiary-fixed">
                        <Icon icon="check" size={13} fill />
                        {formatTime(mark.marked_at) || 'Present'}
                      </span>
                    ) : mark?.status === 'absent' ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-error-container px-2 py-0.5 text-label-sm font-bold text-on-error-container">
                        <Icon icon="close" size={13} />
                        Absent
                      </span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleDraft(guard)}
                    className={`mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold transition-all duration-200 active:scale-[0.98] ${selected ? 'bg-error-container text-on-error-container' : 'bg-primary-container text-on-primary'}`}
                  >
                    <Icon icon={selected ? 'person_remove' : 'person_add'} size={18} />
                    {selected ? 'Remove from event' : 'Add to event'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 border-t border-outline-variant/50 bg-surface-container-lowest/95 px-4 py-2.5 shadow-[var(--shadow-float)] backdrop-blur-md lg:bottom-0 lg:left-[264px]">
        <div className="mx-auto flex max-w-lg items-center gap-2 sm:max-w-[1440px]">
          <Link
            href={backHref}
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-outline-variant px-4 text-label-lg font-bold text-on-surface-variant transition-colors hover:bg-surface-container"
          >
            <Icon icon="close" size={18} />
            Close
          </Link>
          <button
            type="button"
            disabled={saving || loading || !draftReady || !musterEvent}
            onClick={() => void saveSelection()}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary-container px-5 text-label-lg font-bold text-on-primary shadow-md transition-all hover:bg-primary active:scale-95 disabled:opacity-60 disabled:active:scale-100"
          >
            {saving ? <Icon icon="sync" size={18} className="animate-spin" /> : <Icon icon="check" size={18} />}
            {saving ? 'Saving…' : 'Save muster'}
          </button>
        </div>
      </div>
    </div>
  );
}
