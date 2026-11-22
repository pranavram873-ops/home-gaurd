'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  addMusterEventEvidencePhoto,
  attendanceEventId,
  deleteLegacyAttendanceDay,
  deleteMusterEvent,
  getMusterEventParticipants,
  setMusterEventParticipant,
  compressImage,
  filePersonnelReport,
  loadAttendancePage,
  loadAttendanceEvents,
  loadGuardDutyCounts,
  loadBandobastForDate,
  loadGuardDutyHistory,
  loadGuardMemoCount,
  removeMusterEventEvidencePhoto,
  saveGuardPhotoEvidence,
  saveMusterEvent,
  saveDailyMark,
  type AttendanceDivision,
  type AttendanceEventSummary,
  type BandobastEvent,
  type DailyMark,
  type GuardDutyCount,
  type GuardDutyHistory,
  type MusterEvent,
  type RosterGuard,
} from '@/lib/services/simpleAttendanceService';
import { useDivision } from '@/lib/attendance/divisionContext';
import { useAuth } from '@/lib/auth/authContext';
import { Icon } from '@/components/ui/Icon';
import { Card, Chip, EmptyState, SegmentedFilter } from '@/components/ui/primitives';
import { EventDeleteDialog } from '@/components/attendance/EventDeleteDialog';
import { GuardPersonnelMemos } from '@/components/attendance/GuardPersonnelMemos';

function todayLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function formatDay(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return date;
  const today = todayLocal();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
  const prefix = date === today ? 'Today' : date === tomorrowKey ? 'Tomorrow' : date === yesterdayKey ? 'Yesterday' : dt.toLocaleDateString('en-GB', { weekday: 'short' });
  return `${prefix}, ${dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase();
}

function formatProfileDate(date: string | null | undefined) {
  if (!date) return 'Not provided';
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

type AttendanceFilter = 'all' | 'present' | 'absent';

/**
 * Duty history register inside the profile modal: Home Guard code and duty counts.
 */
function DutyHistorySection({ phone }: { phone?: string | null }) {
  const router = useRouter();
  const { role } = useAuth();
  const [history, setHistory] = useState<GuardDutyHistory | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    let live = true;
    setState('loading');
    setShowHistory(false);
    loadGuardDutyHistory(phone)
      .then((result) => {
        if (!live) return;
        setHistory(result);
        setState('ready');
      })
      .catch(() => {
        if (live) setState('error');
      });
    return () => {
      live = false;
    };
  }, [phone]);

  return (
    <div className="w-full border border-outline-variant rounded-lg divide-y divide-outline-variant text-left">
      {state === 'loading' && (
        <p className="px-4 py-3 text-[13px] text-on-surface-variant">Checking attendance register…</p>
      )}
      {state === 'error' && (
        <p className="px-4 py-3 text-[13px] font-semibold text-on-error-container">
          The attendance register could not be loaded.
        </p>
      )}
      {state === 'ready' && !history && (
        <p className="px-4 py-3 text-[13px] text-on-surface-variant">
          Not found in attendance register; duty counts unavailable.
        </p>
      )}
      {state === 'ready' && history && (
        <>
          <div className="px-4 py-3 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-outline font-bold uppercase tracking-wider text-xs">Home Guard Code</span>
              <span className="font-mono text-sm font-bold text-on-surface">{history.homeGuardCode}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-semibold text-on-surface-variant">
                Duties this month{history.divisionName ? ` · ${history.divisionName}` : ''}
              </span>
              <span className="text-lg font-extrabold text-primary tabular-nums">
                {history.months[0]?.present ?? 0}
              </span>
            </div>
          </div>
          <div className="px-4 py-2.5">
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={() => setShowHistory(true)}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-primary font-bold text-xs hover:bg-surface-container-low transition-colors cursor-pointer"
            >
              <Icon icon="history" size={16} />
              <span>View event dates</span>
            </button>
          </div>
        </>
      )}
      {showHistory && history && createPortal(
        <div
          className="overlay-enter fixed inset-0 z-[90] flex items-center justify-center bg-surface-container/50 p-4 backdrop-blur-xs"
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setShowHistory(false); }}
        >
          <section role="dialog" aria-modal="true" aria-labelledby="attendance-profile-event-dates-title" className="overlay-panel flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-2xl">
            <header className="flex shrink-0 items-center justify-between bg-primary p-4 text-on-primary">
              <h2 id="attendance-profile-event-dates-title" className="font-bold">Home Guard event dates</h2>
              <button type="button" onClick={() => setShowHistory(false)} aria-label="Close event dates" className="rounded p-1 hover:bg-white/10">
                <Icon icon="close" size={20} />
              </button>
            </header>
            {history.events.length ? (
              <ul className="divide-y divide-outline-variant overflow-y-auto overscroll-contain p-4">
                {history.events.map((event) => (
                  <li key={`${event.date}-${event.eventId ?? 'legacy'}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowHistory(false);
                        router.push(role === 'admin'
                          ? `/admin/events/${attendanceEventId(history.divisionId, event.date, event.eventId)}`
                          : `/incharge/attendance?date=${encodeURIComponent(event.date)}&division=${encodeURIComponent(history.divisionId)}${event.eventId ? `&eventId=${encodeURIComponent(event.eventId)}` : `&event=${encodeURIComponent(event.eventName ?? '')}`}`);
                      }}
                      className="flex w-full items-center justify-between gap-2 rounded-md py-3 text-left text-[13px] hover:bg-surface-container-low"
                    >
                      <span className="font-semibold text-primary underline underline-offset-2">
                        {formatProfileDate(event.date)}
                        {event.eventName ? ` · ${event.eventName}` : ''}
                      </span>
                      <span className={event.status === 'present' ? 'shrink-0 text-on-tertiary-container' : 'shrink-0 text-error'}>
                        {event.status}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-4 text-center text-sm text-on-surface-variant">No event dates recorded.</p>
            )}
            <footer className="shrink-0 border-t border-outline-variant p-3">
              <button type="button" onClick={() => setShowHistory(false)} className="min-h-10 w-full rounded-lg bg-surface-container text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high">
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

export function AttendanceWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { divisionId, setDivisionId } = useDivision();
  const { role } = useAuth();
  const requestedDate = searchParams.get('date');
  const requestedEventName = searchParams.get('event');
  const requestedEventId = searchParams.get('eventId');
  const [divisions, setDivisions] = useState<AttendanceDivision[]>([]);
  const [date, setDate] = useState(() => requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : todayLocal());
  const [eventMonth, setEventMonth] = useState(() => todayLocal().slice(0, 7));
  const [monthEvents, setMonthEvents] = useState<AttendanceEventSummary[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState('');

  // Event details form state
  const [eventName, setEventName] = useState('');
  const [eventAddress, setEventAddress] = useState('');
  const [musterEvent, setMusterEvent] = useState<MusterEvent | null>(null);
  const [dayEvents, setDayEvents] = useState<MusterEvent[]>([]);
  const [isCreatingAnother, setIsCreatingAnother] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [showDeleteEventDialog, setShowDeleteEventDialog] = useState(false);
  const [uploadingEventPhoto, setUploadingEventPhoto] = useState(false);

  // Roster and marks state
  const [roster, setRoster] = useState<RosterGuard[]>([]);
  const [dutyCounts, setDutyCounts] = useState<Map<string, GuardDutyCount> | null>(null);
  const [marks, setMarks] = useState<DailyMark[]>([]);
  const [selectedGuardIds, setSelectedGuardIds] = useState<string[]>([]);
  const [bandobast, setBandobast] = useState<BandobastEvent[]>([]);
  const [search, setSearch] = useState('');
  const [attendanceFilter, setAttendanceFilter] = useState<AttendanceFilter>('all');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [evidenceByGuard, setEvidenceByGuard] = useState<Record<string, { name: string; dataUrl: string }>>({});

  // Profile Modal State
  const [selectedProfileGuard, setSelectedProfileGuard] = useState<RosterGuard | null>(null);
  const [profileMemoCount, setProfileMemoCount] = useState<number | null>(null);

  // Report Modal State
  const [reportGuard, setReportGuard] = useState<RosterGuard | null>(null);
  const [reportCategory, setReportCategory] = useState('attendance');
  const [reportDescription, setReportDescription] = useState('');
  const [reportEventName, setReportEventName] = useState('');
  const [reportEventDate, setReportEventDate] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportError, setReportError] = useState('');
  const [reportPhoto, setReportPhoto] = useState<string | null>(null);
  const [compressingPhoto, setCompressingPhoto] = useState(false);

  // Image Preview Lightbox State
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  useEffect(() => {
    if (requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) setDate(requestedDate);
  }, [requestedDate]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    const activeRequestedEventId = requestedDate === date ? requestedEventId : null;
    loadAttendancePage(divisionId, date, activeRequestedEventId || undefined)
      .then(async (data) => {
        if (!live) return;
        setDivisions(data.divisions);
        if (!divisionId && data.divisions[0]) setDivisionId(data.divisions[0].id);
        setRoster(data.roster);
        setMarks(data.marks);
        setDayEvents(data.musterEvents);
        let selectedMarks = data.marks;

        // A direct link from the event list must open the selected event rather
        // than landing on the date's event list again. Legacy attendance days
        // may not have a muster_events row, so build the same fallback record
        // used when selecting one from the in-page list.
        if (role === 'incharge' && requestedDate === date) {
          const namedEvent = !requestedEventId && requestedEventName
            ? data.musterEvents.find((event) => event.event_name === requestedEventName)
            : null;
          const namedEventData = namedEvent
            ? await loadAttendancePage(divisionId, date, namedEvent.id)
            : null;
          if (!live) return;
          selectedMarks = namedEventData?.marks ?? data.marks;
          const selectedEvent: MusterEvent | null = data.musterEvent ?? namedEvent ?? (
            data.musterEvents.length === 0 && data.marks.length > 0
              ? {
                  id: `muster-${divisionId}-${date}`,
                  division_id: divisionId,
                  event_date: date,
                  event_name: requestedEventName || `${formatDay(date)} Muster`,
                  created_by: '',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                }
              : null
          );
          setMusterEvent(selectedEvent);
          setEventName(selectedEvent?.event_name ?? '');
          setEventAddress(selectedEvent?.address ?? '');
          if (namedEventData) setMarks(namedEventData.marks);
        }

        // Restore guard photos from database marks
        const photosFromDb: Record<string, { name: string; dataUrl: string }> = {};
        for (const mark of selectedMarks) {
          if (mark.photo_url) {
            photosFromDb[mark.guard_id] = { name: 'Saved Attendance Photo', dataUrl: mark.photo_url };
          }
        }
        setEvidenceByGuard(photosFromDb);
      })
      .catch((reason: unknown) => live && setError(reason instanceof Error ? reason.message : 'Could not load attendance.'))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [divisionId, date, requestedDate, requestedEventName, requestedEventId, role, setDivisionId]);

  useEffect(() => {
    let live = true;
    setDutyCounts(null);
    if (roster.length === 0) return () => { live = false; };
    loadGuardDutyCounts(roster.map((guard) => guard.id))
      .then((counts) => { if (live) setDutyCounts(counts); })
      .catch((cause: unknown) => {
        if (live) setError(cause instanceof Error ? `Duty counts could not be loaded: ${cause.message}` : 'Duty counts could not be loaded.');
      });
    return () => { live = false; };
  }, [roster]);

  useEffect(() => {
    setMusterEvent(null);
    setSelectedGuardIds([]);
    setEventName('');
    setEventAddress('');
    setDayEvents([]);
    setIsCreatingAnother(false);
    setShowEventForm(false);
  }, [divisionId]);

  const selectedMusterEventId = musterEvent?.id;
  useEffect(() => {
    let live = true;
    if (!selectedMusterEventId) { setSelectedGuardIds([]); return; }
    if (selectedMusterEventId.startsWith('muster-')) {
      setSelectedGuardIds(marks.map((mark) => mark.guard_id));
      return () => { live = false; };
    }
    getMusterEventParticipants(selectedMusterEventId).then((ids) => { if (live) setSelectedGuardIds(ids); }).catch((reason) => { if (live) setError(reason instanceof Error ? reason.message : 'Could not load event personnel.'); });
    return () => { live = false; };
  }, [selectedMusterEventId, divisionId, date, marks]);

  async function toggleEventGuard(guard: RosterGuard) {
    if (!musterEvent || musterEvent.id.startsWith('muster-')) return;
    const selected = !selectedGuardIds.includes(guard.id);
    const want = selected ? 'present' : 'absent';
    const priorStatus = markByGuard.get(guard.id)?.status;
    setSelectedGuardIds((current) => selected ? [...current, guard.id] : current.filter((id) => id !== guard.id));
    try {
      await setMusterEventParticipant(musterEvent.id, guard.id, selected);
      if (priorStatus !== want) {
        await saveDailyMark(guard.id, divisionId, date, musterEvent.id, want);
        setMarks((current) => {
          const prior = current.find((mark) => mark.guard_id === guard.id);
          if (prior) return current.map((mark) => (mark.guard_id === guard.id ? { ...mark, status: want } : mark));
          return [...current, {
            id: `${guard.id}-${date}`,
            guard_id: guard.id,
            division_id: divisionId,
            event_id: musterEvent.id,
            attendance_date: date,
            status: want,
            marked_at: new Date().toISOString(),
          }];
        });
      }
    }
    catch (reason) {
      setSelectedGuardIds((current) => selected ? current.filter((id) => id !== guard.id) : [...current, guard.id]);
      setError(reason instanceof Error ? reason.message : 'Could not update event personnel.');
    }
  }

  function openParticipantPicker() {
    if (!divisionId || !musterEvent || musterEvent.id.startsWith('muster-')) return;
    if (role === 'admin') {
      router.push(`/admin/events/${encodeURIComponent(`${divisionId}.${date}.${musterEvent.id}`)}/personnel`);
      return;
    }
    const backHref = encodeURIComponent(`/incharge/attendance?date=${encodeURIComponent(date)}&division=${encodeURIComponent(divisionId)}&eventId=${encodeURIComponent(musterEvent.id)}`);
    router.push(`/incharge/personnel?division=${encodeURIComponent(divisionId)}&date=${encodeURIComponent(date)}&eventId=${encodeURIComponent(musterEvent.id)}&back=${backHref}`);
  }

  useEffect(() => {
    let live = true;
    if (!divisionId) { setMonthEvents([]); return; }
    setEventsLoading(true);
    setEventsError('');
    loadAttendanceEvents(eventMonth, divisionId)
      .then((events) => live && setMonthEvents(events))
      .catch((reason: unknown) => live && setEventsError(reason instanceof Error ? reason.message : 'Could not load this month’s events.'))
      .finally(() => live && setEventsLoading(false));
    return () => { live = false; };
  }, [divisionId, eventMonth]);

  async function createOrUpdateEvent() {
    if (eventName.trim().length < 2) {
      setError('Enter an event name with at least two characters.');
      return;
    }
    setSavingEvent(true);
    setError('');
    setNotice('');
    const previousEventId = musterEvent?.id;
    try {
      const saved = await saveMusterEvent(
        divisionId,
        date,
        eventName,
        eventAddress,
        isCreatingAnother ? undefined : musterEvent?.id.startsWith('muster-') ? undefined : musterEvent?.id,
      );
      setMusterEvent(saved);
      setDayEvents((current) => [...current.filter((event) => event.id !== saved.id), saved]);
      if (saved.id !== previousEventId) {
        setMarks([]);
        setSelectedGuardIds([]);
        setEvidenceByGuard({});
      }
      setEventName(saved.event_name);
      setEventAddress(saved.address ?? '');
      setIsCreatingAnother(false);
      setShowEventForm(false);
      setNotice(`“${saved.event_name}” event created. Upload evidence photos or mark personnel below.`);
      void loadAttendanceEvents(eventMonth, divisionId)
        .then(setMonthEvents)
        .catch((cause: unknown) => setEventsError(cause instanceof Error ? cause.message : 'Could not refresh this month’s events.'));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save this event.');
    } finally {
      setSavingEvent(false);
    }
  }

  async function selectDayEvent(event: AttendanceEventSummary) {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const data = await loadAttendancePage(divisionId, event.date, event.eventId ?? undefined);
      setDate(event.date);
      setDayEvents(data.musterEvents);
      setRoster(data.roster);
      setMarks(data.marks);
      setMusterEvent(data.musterEvent ?? (event.eventId ? null : {
        id: `muster-${divisionId}-${event.date}`,
        division_id: divisionId,
        event_date: event.date,
        event_name: event.eventName || `${formatDay(event.date)} Muster`,
        created_by: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
      setEventName(data.musterEvent?.event_name ?? event.eventName ?? '');
      setEventAddress(data.musterEvent?.address ?? '');
      const photos: Record<string, { name: string; dataUrl: string }> = {};
      for (const mark of data.marks) {
        if (mark.photo_url) photos[mark.guard_id] = { name: 'Saved Attendance Photo', dataUrl: mark.photo_url };
      }
      setEvidenceByGuard(photos);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load this event.');
    } finally {
      setLoading(false);
    }
  }

  async function removeEvent() {
    if (!musterEvent) return;
    setSavingEvent(true);
    setError('');
    try {
      if (musterEvent.id.startsWith('muster-')) {
        await deleteLegacyAttendanceDay(divisionId, date);
      } else {
        await deleteMusterEvent(musterEvent.id);
      }
      setShowDeleteEventDialog(false);
      setMusterEvent(null);
      setDayEvents((current) => current.filter((event) => event.id !== musterEvent.id));
      setMonthEvents((current) => current.filter((event) => event.eventId !== musterEvent.id));
      setEventName('');
      setEventAddress('');
      setShowEventForm(false);
      setMarks([]);
      setNotice('Event and its attendance records deleted.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not delete this event.');
    } finally {
      setSavingEvent(false);
    }
  }

  async function uploadEventEvidencePhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingEventPhoto(true);
    setError('');
    setNotice('');
    try {
      const compressed = await compressImage(file, 1200, 1200, 0.8);
      if (!musterEvent || musterEvent.id.startsWith('muster-')) throw new Error('Create an event before attaching evidence.');
      const updatedPhotos = await addMusterEventEvidencePhoto(musterEvent.id, compressed);
      setMusterEvent((prev) => (prev ? { ...prev, evidence_photos: updatedPhotos } : null));
      setNotice('Event photo evidence uploaded and saved. Visible to admins.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not upload event evidence photo.');
    } finally {
      setUploadingEventPhoto(false);
      event.target.value = '';
    }
  }

  async function handleRemoveEventEvidencePhoto(index: number) {
    setError('');
    setNotice('');
    try {
      if (!musterEvent || musterEvent.id.startsWith('muster-')) throw new Error('Create an event before removing evidence.');
      const updatedPhotos = await removeMusterEventEvidencePhoto(musterEvent.id, index);
      setMusterEvent((prev) => (prev ? { ...prev, evidence_photos: updatedPhotos } : null));
      setNotice('Event photo evidence removed.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not remove photo evidence.');
    }
  }

  useEffect(() => {
    let live = true;
    loadBandobastForDate(date)
      .then((events) => live && setBandobast(events))
      .catch(() => live && setBandobast([]));
    return () => { live = false; };
  }, [date]);

  const markByGuard = useMemo(() => new Map(marks.map((mark) => [mark.guard_id, mark])), [marks]);
  const filteredRoster = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return roster;
    return roster.filter((guard) =>
      `${guard.full_name} ${guard.phone} ${guard.home_guard_code}`.toLowerCase().includes(term),
    );
  }, [roster, search]);

  const eventMarks = marks.filter((mark) => selectedGuardIds.includes(mark.guard_id));
  const presentCount = eventMarks.filter((mark) => mark.status === 'present').length;
  const absentCount = eventMarks.filter((mark) => mark.status === 'absent').length;
  const visibleEventGuards = filteredRoster.filter((guard) => {
    if (!selectedGuardIds.includes(guard.id)) return false;
    if (attendanceFilter === 'all') return true;
    return markByGuard.get(guard.id)?.status === attendanceFilter;
  });
  const eventPresentPercent = selectedGuardIds.length ? Math.round((presentCount / selectedGuardIds.length) * 100) : 0;
  const eventAbsentPercent = selectedGuardIds.length ? Math.round((absentCount / selectedGuardIds.length) * 100) : 0;
  const selectedDivision = divisions.find((division) => division.id === divisionId);
  const divisionBandobast = useMemo(() => {
    if (!selectedDivision) return null;
    const needle = selectedDivision.name.toLowerCase();
    return bandobast.find((event) => (event.venue ?? event.title).toLowerCase().includes(needle)) ?? null;
  }, [bandobast, selectedDivision]);

  async function changeStatus(guard: RosterGuard, status: 'present' | 'absent') {
    setSavingId(guard.id);
    setError('');
    setNotice('');
    try {
      if (!musterEvent || musterEvent.id.startsWith('muster-')) throw new Error('Choose a saved event before recording attendance.');
      await saveDailyMark(guard.id, divisionId, date, musterEvent.id, status);
      setMarks((current) => {
        const prior = current.find((mark) => mark.guard_id === guard.id);
        if (prior) return current.map((mark) => mark.guard_id === guard.id ? { ...mark, status } : mark);
        return [...current, {
          id: `${guard.id}-${date}`,
          guard_id: guard.id,
          division_id: divisionId,
          event_id: musterEvent.id,
          attendance_date: date,
          status,
          marked_at: new Date().toISOString(),
        }];
      });
      setNotice(`${guard.full_name} marked ${status}. Attendance saved.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save this attendance mark.');
    } finally {
      setSavingId(null);
    }
  }

  async function attachEvidence(guard: RosterGuard, event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError('Please upload a photo smaller than 10 MB.');
      event.target.value = '';
      return;
    }

    setSavingId(guard.id);
    setError('');
    setNotice('');
    try {
      const compressed = await compressImage(file, 1200, 1200, 0.8);
      if (!musterEvent || musterEvent.id.startsWith('muster-')) throw new Error('Choose a saved event before attaching attendance evidence.');
      await saveGuardPhotoEvidence(guard.id, divisionId, date, musterEvent.id, compressed);
      setEvidenceByGuard((current) => ({
        ...current,
        [guard.id]: { name: file.name, dataUrl: compressed },
      }));
      setMarks((current) => {
        const prior = current.find((m) => m.guard_id === guard.id);
        if (prior) return current.map((m) => (m.guard_id === guard.id ? { ...m, photo_url: compressed } : m));
        return [...current, {
          id: `${guard.id}-${date}`,
          guard_id: guard.id,
          division_id: divisionId,
          event_id: musterEvent.id,
          attendance_date: date,
          status: 'present',
          photo_url: compressed,
          marked_at: new Date().toISOString(),
        }];
      });
      setNotice(`${guard.full_name} photo evidence uploaded & saved for admin inspection.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save guard photo evidence.');
    } finally {
      setSavingId(null);
      event.target.value = '';
    }
  }

  async function openProfileModal(guard: RosterGuard) {
    setSelectedProfileGuard(guard);
    setProfileMemoCount(null);
    try {
      const count = await loadGuardMemoCount(guard.id, guard.phone);
      setProfileMemoCount(count);
    } catch {
      setProfileMemoCount(0);
    }
  }

  function openReportModal(guard: RosterGuard) {
    setReportGuard(guard);
    setReportCategory('attendance');
    setReportDescription('');
    setReportEventName(eventName || `${selectedDivision?.name || 'Muster'} event`);
    setReportEventDate(date);
    setReportPhoto(null);
    setReportError('');
  }

  async function attachReportPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setCompressingPhoto(true);
    setReportError('');
    try {
      setReportPhoto(await compressImage(file, 1200, 1200, 0.8));
    } catch {
      setReportError('Could not process that photo. Please try a different image.');
    } finally {
      setCompressingPhoto(false);
    }
  }

  async function submitPersonnelReport(event: React.FormEvent) {
    event.preventDefault();
    if (!reportGuard || !reportDescription.trim() || !reportEventName.trim() || !reportPhoto) return;
    setSubmittingReport(true);
    setReportError('');
    try {
      await filePersonnelReport({
        guardId: reportGuard.id,
        divisionId,
        category: reportCategory,
        description: reportDescription.trim(),
        evidencePhoto: reportPhoto,
        eventName: reportEventName,
        eventDate: reportEventDate,
      });
      setNotice(`Report successfully filed against ${reportGuard.full_name}. Command review initiated.`);
      setReportGuard(null);
      setReportPhoto(null);
    } catch (cause) {
      setReportError(cause instanceof Error ? cause.message : 'Could not submit report. Try again.');
    } finally {
      setSubmittingReport(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-3 pb-28 lg:max-w-none lg:space-y-5">
      {role === 'incharge' && requestedDate && (
        <button
          type="button"
          onClick={() => router.push('/incharge/attendance')}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-surface-container-low px-3 text-sm font-bold text-primary transition hover:bg-surface-container"
        >
          <Icon icon="arrow_back" size={18} />
          Back to events
        </button>
      )}
      {/* Operational context banner */}
      <section className="rounded-xl bg-surface-container-low p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-sm text-on-primary shadow-sm">
            <Icon icon="shield" size={16} fill className="text-on-secondary-container" />
            <span className="max-w-[160px] truncate">{selectedDivision?.name || 'Loading division…'}</span>
          </span>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-surface-container-highest px-3 py-1.5 text-sm text-on-surface shadow-sm transition-colors hover:bg-surface-container-high">
            <Icon icon="calendar_today" size={16} className="text-primary" />
            <span>{formatDay(date)}</span>
            <input
              type="date"
              value={date}
              onChange={(event) => {
                if (!event.target.value) return;
                setMusterEvent(null);
                setDayEvents([]);
                setIsCreatingAnother(false);
                setShowEventForm(false);
                setEventName('');
                setEventAddress('');
                setDate(event.target.value);
              }}
              className="absolute h-0 w-0 opacity-0"
              aria-label="Event date"
            />
          </label>
        </div>

        {divisionBandobast && (
          <Card className="mt-3 p-3">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-center gap-1.5 text-on-surface-variant">
                  <Icon icon="event_note" size={14} />
                  <span className="text-label-sm uppercase tracking-wider">Bandobast Operation</span>
                </div>
                <p className="truncate text-headline-sm text-on-surface">{divisionBandobast.title}</p>
                {divisionBandobast.venue && (
                  <p className="mt-0.5 truncate text-label-sm text-on-surface-variant">{divisionBandobast.venue}</p>
                )}
              </div>
              <Chip tone="solid" className="!text-[13px]">Muster Roll Active</Chip>
            </div>
          </Card>
        )}
      </section>

      {/* Event creation and edit modal */}
      {showEventForm && (
        <div
          className="overlay-enter fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-surface-container/40 p-3 pb-6 pt-[8vh] backdrop-blur-xs sm:p-4 sm:pt-[10vh]"
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setShowEventForm(false); }}
        >
        <Card className="max-h-[90dvh] w-full max-w-lg overflow-y-auto p-4 sm:p-5">
          <div className="mb-4 flex items-start justify-between gap-2 border-b border-outline-variant/50 pb-3">
            <div>
              <h2 className="text-headline-sm font-bold text-on-surface">
                {musterEvent && !isCreatingAnother ? 'Edit Event Details' : 'Create New Event'}
              </h2>
              <p className="text-sm text-on-surface-variant">
                Fill in event details to open muster roll and attach photo evidence.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowEventForm(false);
                setIsCreatingAnother(false);
                setEventName(musterEvent?.event_name ?? '');
                setEventAddress(musterEvent?.address ?? '');
              }}
              className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container"
              aria-label="Close event form"
            >
              <Icon icon="close" size={20} />
            </button>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); void createOrUpdateEvent(); }} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="muster-event-name" className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">
                  Name of the Event *
                </label>
                <input
                  id="muster-event-name"
                  type="text"
                  required
                  value={eventName}
                  onChange={(event) => setEventName(event.target.value)}
                  maxLength={140}
                  placeholder="e.g. Annual Parade & Inspection"
                  className="h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label htmlFor="muster-event-date" className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">
                  Date of the Event *
                </label>
                <input
                  id="muster-event-date"
                  type="date"
                  required
                  value={date}
                  disabled={Boolean(musterEvent && !musterEvent.id.startsWith('muster-') && !isCreatingAnother)}
                  onChange={(event) => setDate(event.target.value)}
                  className="h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label htmlFor="muster-event-address" className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">
                Address / Location of Event *
              </label>
              <input
                id="muster-event-address"
                type="text"
                value={eventAddress}
                onChange={(event) => setEventAddress(event.target.value)}
                placeholder="e.g. Police Parade Ground, Taluk Office Road"
                className="h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {divisions.length > 0 && (
              <div>
                <label htmlFor="muster-event-division" className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">
                  Division Command
                </label>
                <select
                  id="muster-event-division"
                  value={divisionId}
                  onChange={(e) => setDivisionId(e.target.value)}
                  className="h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {divisions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowEventForm(false);
                  setIsCreatingAnother(false);
                  setEventName(musterEvent?.event_name ?? '');
                  setEventAddress(musterEvent?.address ?? '');
                }}
                className="h-11 rounded-lg px-4 text-sm font-semibold text-on-surface-variant hover:bg-surface-container"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingEvent || !divisionId || eventName.trim().length < 2}
                className="flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-bold text-on-primary transition hover:bg-primary/90 disabled:opacity-60 cursor-pointer"
              >
                {savingEvent ? <Icon icon="sync" size={18} className="animate-spin" /> : <Icon icon="event_available" size={18} />}
                {savingEvent ? 'Saving Event…' : musterEvent && !isCreatingAnother ? 'Update Event Details' : 'Create & Show Personnel'}
              </button>
            </div>
          </form>
        </Card>
        </div>
      )}
      {dayEvents.length > 1 && (
        <Card className="space-y-2 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
            Select an event for {formatDay(date)}
          </p>
          <div className="flex flex-wrap gap-2">
            {dayEvents.map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => void selectDayEvent({
                  id: attendanceEventId(event.division_id, event.event_date, event.id),
                  eventId: event.id,
                  divisionId: event.division_id,
                  divisionName: selectedDivision?.name ?? 'Division',
                  date: event.event_date,
                  eventName: event.event_name,
                  presentCount: 0,
                  absentCount: 0,
                  sanctionedCount: 0,
                  markedCount: 0,
                  isOpen: true,
                })}
                className={`min-h-10 rounded-lg border px-3 text-sm font-semibold ${musterEvent?.id === event.id ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container'}`}
              >
                {event.event_name}
              </button>
            ))}
          </div>
        </Card>
      )}
      {musterEvent && (
        <Card className="p-4 flex flex-col gap-3">
          {musterEvent.id.startsWith('muster-') && (
            <p className="rounded-lg bg-secondary-container px-3 py-2 text-sm text-on-secondary-container">
              This is legacy attendance without a named event. Create an event before recording or editing attendance.
            </p>
          )}
          <div className="flex flex-col gap-3 border-b border-outline-variant/40 pb-3">
            <div className="grid w-full grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:flex sm:flex-wrap sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsCreatingAnother(false);
                  setEventName(musterEvent.event_name);
                  setEventAddress(musterEvent.address ?? '');
                  setShowEventForm(true);
                }}
                className="flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-lg border border-outline-variant px-2.5 text-sm font-semibold text-primary transition-colors hover:bg-surface-container sm:px-3"
              >
                <Icon icon="edit" size={18} />
                <span className="truncate">Edit event</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreatingAnother(true);
                  setEventName('');
                  setEventAddress('');
                  setShowEventForm(true);
                }}
                className="flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-lg border border-outline-variant px-2.5 text-sm font-semibold text-primary transition-colors hover:bg-surface-container sm:px-3"
              >
                <Icon icon="add" size={18} />
                <span className="truncate">Create another</span>
              </button>
              <button type="button" onClick={openParticipantPicker} disabled={musterEvent.id.startsWith('muster-')} className="flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-lg bg-primary-container px-2.5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50 sm:px-3">
                <Icon icon="person_add" size={18} />
                <span className="truncate">Add personnel</span>
              </button>
              {role === 'admin' && (
                <button type="button" onClick={() => { setError(''); setShowDeleteEventDialog(true); }} disabled={savingEvent} className="col-span-1 flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-lg bg-error-container px-3 text-sm font-semibold text-on-error-container transition-colors hover:bg-error-container/80 disabled:opacity-60 min-[380px]:col-span-2 sm:col-span-1">
                  <Icon icon="delete" size={18} />
                  <span>Delete event</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-container text-on-primary">
                <Icon icon="event_available" size={24} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                  Event · {formatDay(date)} · {selectedDivision?.name}
                </p>
                <h2 className="truncate text-headline-sm font-bold text-on-surface">{musterEvent.event_name}</h2>
                {musterEvent.address && (
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-on-surface-variant">
                    <Icon icon="location_on" size={15} className="text-primary shrink-0" />
                    <span className="truncate">{musterEvent.address}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Event Evidence Photos Upload & Gallery Section */}
          <div className="mt-2 border-t border-outline-variant/50 pt-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                <Icon icon="add_a_photo" size={16} className="text-primary" />
                <span>Event Evidence Photos ({(musterEvent.evidence_photos || []).length} attached)</span>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary-container px-3 py-1.5 text-xs font-bold text-on-primary shadow-xs transition hover:bg-primary">
                {uploadingEventPhoto ? <Icon icon="sync" size={15} className="animate-spin" /> : <Icon icon="upload" size={15} />}
                <span>{uploadingEventPhoto ? 'Uploading…' : 'Add Event Photo'}</span>
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploadingEventPhoto || musterEvent.id.startsWith('muster-')}
                  className="hidden"
                  onChange={(e) => void uploadEventEvidencePhoto(e)}
                />
              </label>
            </div>

            {(musterEvent.evidence_photos || []).length > 0 ? (
              <div className="flex flex-wrap gap-2.5 mt-2">
                {(musterEvent.evidence_photos || []).map((photoUrl, idx) => (
                  <div key={idx} className="relative group h-20 w-24 rounded-lg overflow-hidden border border-outline-variant bg-surface-container shadow-xs">
                    <img
                      src={photoUrl}
                      alt={`Event evidence ${idx + 1}`}
                      className="h-full w-full object-cover cursor-pointer hover:scale-105 transition-transform"
                      onClick={() => setPreviewImage({ url: photoUrl, title: `Event Evidence Photo #${idx + 1}` })}
                    />
                    <button
                      type="button"
                      onClick={() => void handleRemoveEventEvidencePhoto(idx)}
                      className="absolute top-1 right-1 h-6 w-6 rounded-full bg-surface-container/90 text-on-surface hover:bg-error hover:text-on-error flex items-center justify-center transition"
                      title="Remove photo"
                    >
                      <Icon icon="close" size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs italic text-on-surface-variant/80">
                No event evidence photos attached yet.
              </p>
            )}
          </div>
        </Card>
      )}

      {musterEvent && (
        <section aria-label="Event attendance summary" className="grid grid-cols-3 gap-2">
          <div className="flex min-w-0 flex-col justify-between rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-3 shadow-sm">
            <div className="mb-1 flex items-center justify-between gap-1 text-on-tertiary-container"><span className="text-[10px] font-bold uppercase tracking-wide">Present</span><Icon icon="check_circle" size={17} fill /></div>
            <div><span className="text-headline-lg tracking-tight text-primary">{loading ? '—' : presentCount}</span><p className="mt-0.5 text-[10px] font-semibold text-on-tertiary-container">{eventPresentPercent}%</p></div>
          </div>
          <div className="flex min-w-0 flex-col justify-between rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-3 shadow-sm">
            <div className="mb-1 flex items-center justify-between gap-1 text-error"><span className="text-[10px] font-bold uppercase tracking-wide">Absent</span><Icon icon="cancel" size={17} fill /></div>
            <div><span className="text-headline-lg tracking-tight text-error">{loading ? '—' : absentCount}</span><p className="mt-0.5 text-[10px] font-semibold text-error">{eventAbsentPercent}%</p></div>
          </div>
          <div className="flex min-w-0 flex-col justify-between rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-3 shadow-sm">
            <div className="mb-1 flex items-center justify-between gap-1 text-on-surface-variant"><span className="text-[10px] font-bold uppercase tracking-wide">In event</span><Icon icon="groups" size={17} /></div>
            <div><span className="text-headline-lg tracking-tight text-primary">{loading ? '—' : selectedGuardIds.length}</span><p className="mt-0.5 text-[10px] font-medium text-on-surface-variant">Home Guards</p></div>
          </div>
        </section>
      )}

      {notice && (
        <div role="status" className="alert-enter flex items-start gap-2.5 rounded-lg bg-tertiary-fixed p-3 text-on-tertiary-fixed-variant">
          <Icon icon="check_circle" size={18} fill className="mt-0.5 shrink-0" />
          <span className="min-w-0 flex-1 text-sm">{notice}</span>
        </div>
      )}
      {error && (
        <div role="alert" className="alert-enter flex items-start gap-2.5 rounded-lg bg-error-container p-3 text-on-error-container">
          <Icon icon="error" size={18} fill className="mt-0.5 shrink-0 text-error" />
          <span className="min-w-0 flex-1 text-sm">{error}</span>
        </div>
      )}

      {/* Roster of Home Guards in that division */}
      {musterEvent && (
        <>
        <Card className="overflow-hidden">
          <div className="border-b border-outline-variant/60 p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div><h3 className="text-headline-sm font-bold text-primary">Event personnel</h3><p className="text-xs text-on-surface-variant">{selectedGuardIds.length} Home Guards added</p></div>
            </div>
            <SegmentedFilter<AttendanceFilter>
              label="Filter attendance"
              value={attendanceFilter}
              onChange={setAttendanceFilter}
              className="mb-3 bg-surface-container-high"
              options={[
                { value: 'all', label: 'All', count: selectedGuardIds.length },
                { value: 'present', label: 'Present', count: presentCount },
                { value: 'absent', label: 'Absent', count: absentCount },
              ]}
            />
            <div className="relative w-full">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-on-surface-variant">
                <Icon icon="search" size={20} />
              </span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                type="search"
                aria-label="Search the roster"
                placeholder="Search guard by name or HG code..."
                className="h-12 w-full rounded-xl bg-surface-container-lowest pl-10 pr-3 text-label-lg text-on-surface shadow-sm ring-primary-container placeholder:text-outline focus:outline-none focus:ring-2 sm:pr-28"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 p-12 text-sm text-on-surface-variant">
              <Icon icon="sync" size={20} className="animate-spin" />
              Loading attendance…
            </div>
          ) : roster.length === 0 ? (
            <EmptyState
              icon="groups"
              title="No Home Guards in this division yet"
              body="No active Home Guards are available to add to this event."
            />
          ) : visibleEventGuards.length === 0 ? (
            <p className="p-8 text-center text-sm text-on-surface-variant">
              {attendanceFilter === 'all' ? 'No Home Guards match that search.' : `No ${attendanceFilter} Home Guards match that search.`}
            </p>
          ) : (
            <ul className="stagger-in flex flex-col gap-2 p-3 sm:p-4">
              {visibleEventGuards.map((guard) => {
                const mark = markByGuard.get(guard.id);
                const isSaving = savingId === guard.id;
                const guardPhoto = evidenceByGuard[guard.id]?.dataUrl || mark?.photo_url;
                return (
                  <li key={guard.id} className="card-hover-lift rounded-xl bg-surface-container-low p-3.5 shadow-sm transition-all duration-200 hover:bg-surface-container/70">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => void openProfileModal(guard)}
                        className="flex min-w-0 items-center gap-3 text-left transition hover:opacity-85 cursor-pointer group"
                        title="Click to view full personnel profile"
                      >
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary font-extrabold text-sm shadow-xs group-hover:scale-105 transition-transform duration-200">
                          {initials(guard.full_name)}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-base font-bold text-on-surface group-hover:text-primary transition-colors duration-200">
                              {guard.full_name}
                            </p>
                            <Icon icon="info" size={16} className="text-primary shrink-0 opacity-70 group-hover:opacity-100 transition-opacity duration-200" />
                          </div>
                          <div className="mt-1 grid w-fit grid-cols-2 items-center gap-x-3 whitespace-nowrap text-xs font-semibold">
                            <span className="text-on-surface-variant">
                              Attended: <span className="font-extrabold tabular-nums text-tertiary">{dutyCounts?.get(guard.id)?.attended ?? '—'}</span>
                            </span>
                            <span className="text-error">
                              Not attended: <span className="font-extrabold tabular-nums">{dutyCounts?.get(guard.id)?.notAttended ?? '—'}</span>
                            </span>
                          </div>
                        </div>
                      </button>

                      <div className="flex items-center gap-2 shrink-0">
                        {mark?.status === 'present' ? (
                          <Chip tone="present" icon="check_circle" className="!text-[13px] animate-check-pop">Present</Chip>
                        ) : mark?.status === 'absent' ? (
                          <Chip tone="absent" icon="cancel" className="!text-[13px] animate-check-pop">Absent</Chip>
                        ) : (
                          <Chip tone="pending" className="!text-[13px]">Not marked</Chip>
                        )}
                        <button
                          type="button"
                          onClick={() => openReportModal(guard)}
                          className="flex items-center gap-1 rounded-lg bg-error-container/70 hover:bg-error-container px-2.5 py-1.5 text-xs font-bold text-on-error-container transition-all duration-200 active:scale-95 cursor-pointer"
                          title={`Report ${guard.full_name}`}
                        >
                          <Icon icon="report_problem" size={15} className="text-error shrink-0" />
                          <span>Report</span>
                        </button>
                      </div>
                    </div>

                    <>
                    <button type="button" onClick={() => void toggleEventGuard(guard)} className="mt-3 flex min-h-9 w-full items-center justify-center gap-2 rounded-lg bg-error-container px-3 text-xs font-bold text-on-error-container transition-all duration-200 active:scale-[0.98]">
                      <Icon icon="person_remove" size={16} /> Remove from event
                    </button>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <span className="sr-only">Attendance status for {guard.full_name}</span>
                      <button type="button" disabled={isSaving || !musterEvent || musterEvent.id.startsWith('muster-')} onClick={() => void changeStatus(guard, 'present')} className={`flex h-11 items-center justify-center gap-1.5 rounded-lg text-sm font-bold transition-all duration-200 active:scale-[0.98] disabled:opacity-60 ${mark?.status === 'present' ? 'bg-on-tertiary-container text-on-tertiary shadow-sm' : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'}`}>{isSaving && mark?.status !== 'present' ? <Icon icon="sync" size={18} className="animate-spin" /> : <Icon icon="check" size={18} className={mark?.status === 'present' ? 'animate-check-pop' : ''} />} Present</button>
                      <button type="button" disabled={isSaving || !musterEvent || musterEvent.id.startsWith('muster-')} onClick={() => void changeStatus(guard, 'absent')} className={`flex h-11 items-center justify-center gap-1.5 rounded-lg text-sm font-bold transition-all duration-200 active:scale-[0.98] disabled:opacity-60 ${mark?.status === 'absent' ? 'bg-error text-on-error shadow-sm' : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'}`}>{isSaving && mark?.status !== 'absent' ? <Icon icon="sync" size={18} className="animate-spin" /> : <Icon icon="close" size={18} className={mark?.status === 'absent' ? 'animate-check-pop' : ''} />} Absent</button>
                    </div></>

                    <div className="mt-3 rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-2">
                      <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-label-md text-primary hover:bg-surface-container">
                        <span className="flex items-center gap-2">
                          <Icon icon="add_photo_alternate" size={18} />
                          Add photo evidence
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                        disabled={musterEvent.id.startsWith('muster-')}
                          onChange={(event) => void attachEvidence(guard, event)}
                        />
                        <Icon icon="upload_file" size={18} />
                      </label>
                      {guardPhoto && (
                        <div className="mt-2 flex items-center gap-2.5 rounded-lg bg-surface-container-low p-2">
                          <img
                            src={guardPhoto}
                            alt={`${guard.full_name} evidence`}
                            className="h-16 w-20 object-cover rounded-md cursor-pointer hover:scale-105 transition-transform"
                            onClick={() => setPreviewImage({ url: guardPhoto, title: `${guard.full_name} (${guard.home_guard_code}) - Photo Evidence` })}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-primary flex items-center gap-1">
                              <Icon icon="verified" size={14} className="text-tertiary shrink-0" />
                              Saved & Visible to Admin
                            </p>
                            <p className="text-[11px] text-on-surface-variant truncate">Click thumbnail to expand photo</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        </>
      )}

      {/* Events this month card - only shown when NOT inside an active event */}
      {!musterEvent && (
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-outline-variant/60 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
            <div><h2 className="text-headline-sm font-bold text-on-surface">Events this month</h2><p className="text-sm text-on-surface-variant">Events for {selectedDivision?.name ?? 'this district'}.</p></div>
            <div className="flex items-center gap-2">
              <label className="flex min-h-10 items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-label-md text-on-surface">
                <Icon icon="calendar_month" size={18} className="text-primary" />
                <span className="sr-only">Choose event month</span>
                <input type="month" value={eventMonth} max={todayLocal().slice(0, 7)} onChange={(event) => event.target.value && setEventMonth(event.target.value)} className="min-w-0 bg-transparent text-sm outline-none" aria-label="Choose event month" />
              </label>
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setIsCreatingAnother(false);
                  setEventName('');
                  setEventAddress('');
                  setShowEventForm(true);
                }}
                disabled={loading || !divisionId}
                className="flex min-h-10 items-center gap-1.5 rounded-lg bg-primary px-3 text-label-md font-bold text-on-primary hover:bg-primary/90 disabled:opacity-60"
              >
                <Icon icon="add" size={17} />
                <span>Create event</span>
              </button>
            </div>
          </div>
          <div className="space-y-2 p-3 sm:p-4">
            {eventsError ? <p role="alert" className="rounded-lg bg-error-container p-3 text-sm text-on-error-container">{eventsError}</p> : eventsLoading ? <p className="py-6 text-center text-sm text-on-surface-variant">Loading events…</p> : monthEvents.length ? monthEvents.map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => {
                  setShowEventForm(false);
                  void selectDayEvent(event);
                }}
                className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-surface-container ${event.date === date ? 'bg-primary-fixed/60 ring-1 ring-primary/30' : 'bg-surface-container-low'}`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-container-high text-primary"><Icon icon="event" size={20} /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-label-lg font-bold text-on-surface">{event.eventName || `${formatDay(event.date)} Muster`}</span><span className="text-xs text-on-surface-variant">{formatDay(event.date)} · {event.markedCount} marked</span></span>
                <span className="text-right text-xs text-on-surface-variant"><strong className="text-on-tertiary-container">{event.presentCount}</strong> present · <strong className="text-error">{event.absentCount}</strong> absent</span>
                <Icon icon="chevron_right" size={20} className="text-on-surface-variant" />
              </button>
            )) : <p className="py-6 text-center text-sm text-on-surface-variant">No events recorded for {selectedDivision?.name ?? 'this district'} in this month.</p>}
          </div>
        </Card>
      )}

      {/* Personnel Profile Modal */}
      {selectedProfileGuard && (
        <div className="overlay-enter fixed inset-0 z-50 flex items-center justify-center bg-surface-container/40 p-4 backdrop-blur-xs">
          <div className="overlay-panel flex max-h-[90vh] w-full max-w-sm flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-2xl">
            <div className="p-4 bg-primary text-on-primary flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Icon icon="shield" size={20} className="text-on-primary" />
                <h3 className="font-bold text-sm">Personnel Profile</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProfileGuard(null)}
                className="text-on-primary hover:text-outline cursor-pointer"
                aria-label="Close profile"
              >
                <Icon icon="close" size={20} />
              </button>
            </div>

            <div className="p-6 flex flex-col items-center gap-4 text-center overflow-y-auto">
              <div className="w-16 h-16 rounded-full bg-primary text-on-primary font-extrabold text-2xl flex items-center justify-center">
                {initials(selectedProfileGuard.full_name)}
              </div>
              <div className="flex flex-col gap-1 w-full">
                <span className="text-outline font-bold uppercase tracking-wider text-xs">Home Guard code</span>
                <span className="font-mono text-xl font-extrabold text-primary">
                  {selectedProfileGuard.home_guard_code}
                </span>
                <span className="text-outline font-bold uppercase tracking-wider text-xs mt-2">Name</span>
                <span className="text-lg font-bold text-on-surface">{selectedProfileGuard.full_name}</span>
                <span className="text-outline font-bold uppercase tracking-wider text-xs mt-2">Division Command</span>
                <span className="text-lg font-bold text-primary">
                  {divisions.find((d) => d.id === selectedProfileGuard.division_id)?.name || selectedDivision?.name || 'Home Guards'} Division
                </span>
                <span className="text-outline font-bold uppercase tracking-wider text-xs mt-2">Mobile Number</span>
                <span className="text-lg font-semibold text-on-surface">
                  {selectedProfileGuard.phone || 'Not provided'}
                </span>
                <span className="text-outline font-bold uppercase tracking-wider text-xs mt-2">Date of birth</span>
                <span className="text-sm font-semibold text-on-surface">
                  {formatProfileDate(selectedProfileGuard.date_of_birth)}
                </span>
                <span className="text-outline font-bold uppercase tracking-wider text-xs mt-2">Joining date</span>
                <span className="text-sm font-semibold text-on-surface">
                  {formatProfileDate(selectedProfileGuard.joining_date)}
                </span>
                <span className="text-outline font-bold uppercase tracking-wider text-xs mt-2">Rank / Designation</span>
                <span className="text-sm font-semibold text-on-surface">Home Guard Volunteer</span>
              </div>

              <DutyHistorySection phone={selectedProfileGuard.phone} />

              <div className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3 text-left">
                <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">Memos on file</p>
                <p className="mt-1 flex items-center gap-2 text-lg font-extrabold text-primary">
                  {profileMemoCount ?? 0}
                  <span className="text-sm font-medium text-on-surface-variant">
                    {(profileMemoCount ?? 0) === 1 ? 'memo' : 'memos'}
                  </span>
                </p>
                <GuardPersonnelMemos guardId={selectedProfileGuard.id} onNavigate={() => setSelectedProfileGuard(null)} />
              </div>

              <div className="flex flex-col gap-2 w-full mt-2">
                <button
                  type="button"
                  onClick={() => {
                    const guard = selectedProfileGuard;
                    setSelectedProfileGuard(null);
                    openReportModal(guard);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-error-container text-on-error-container font-bold text-sm hover:bg-error-container/80 transition cursor-pointer"
                >
                  <Icon icon="report_problem" size={18} className="text-error" />
                  <span>Report Personnel</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedProfileGuard(null)}
                  className="w-full px-4 py-2.5 rounded-lg bg-surface-container text-on-surface-variant font-semibold hover:bg-surface-container-high transition cursor-pointer text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File Personnel Report Modal */}
      {reportGuard && (
        <div className="overlay-enter fixed inset-0 z-50 flex items-center justify-center bg-surface-container/40 p-4 backdrop-blur-xs">
          <div className="overlay-panel flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-2xl">
            <div className="p-4 bg-primary text-on-primary flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon icon="edit_document" size={20} className="text-on-primary" />
                <h3 className="font-bold text-sm">File Personnel Report</h3>
              </div>
              <button
                type="button"
                onClick={() => setReportGuard(null)}
                className="text-on-primary hover:text-outline cursor-pointer"
              >
                <Icon icon="close" size={20} />
              </button>
            </div>

            <form onSubmit={(e) => void submitPersonnelReport(e)} className="flex flex-col gap-4 overflow-y-auto p-5 text-xs">
              <div className="rounded-lg bg-primary-fixed p-3 text-xs text-on-primary-fixed">
                <strong>{reportGuard.full_name}</strong>
                <span className="block text-on-primary-fixed/80 mt-0.5 font-mono">
                  HG Code: {reportGuard.home_guard_code} • {selectedDivision?.name}
                </span>
              </div>

              <label className="block font-bold text-on-surface-variant text-xs">
                Event / duty name
                <input required value={reportEventName} onChange={(event) => setReportEventName(event.target.value)} maxLength={140} className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm font-normal text-on-surface" />
              </label>
              <label className="block font-bold text-on-surface-variant text-xs">
                Event date
                <input required type="date" value={reportEventDate} onChange={(event) => setReportEventDate(event.target.value)} className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm font-normal text-on-surface" />
              </label>

              <div>
                <label htmlFor="report-category" className="font-bold text-on-surface-variant block mb-1 text-xs">
                  Report Category
                </label>
                <select
                  id="report-category"
                  value={reportCategory}
                  onChange={(e) => setReportCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg text-on-surface bg-surface-container-lowest text-sm"
                >
                  <option value="attendance">Late / Absent from Duty</option>
                  <option value="conduct">Conduct or Insubordination</option>
                  <option value="safety">Safety Concern</option>
                  <option value="other">Other Disciplinary Concern</option>
                </select>
              </div>

              <div>
                <label htmlFor="report-description" className="font-bold text-on-surface-variant block mb-1 text-xs">
                  Incident Description
                </label>
                <textarea
                  id="report-description"
                  required
                  maxLength={4000}
                  rows={4}
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  placeholder="Describe the incident or reason for filing this report..."
                  className="w-full p-3 border border-outline-variant rounded-lg text-on-surface bg-surface-container-lowest text-sm focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-outline"
                />
              </div>

              <div>
                <span className="font-bold text-on-surface-variant block mb-1 text-xs">Memo photo <span className="text-error">(required)</span></span>
                {reportPhoto ? (
                  <div className="flex items-center gap-2.5 rounded-lg bg-surface-container-low p-2">
                    <img src={reportPhoto} alt="Report memo" className="h-14 w-20 rounded-md object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-primary flex items-center gap-1">
                        <Icon icon="verified" size={14} className="text-tertiary shrink-0" />
                        Memo attached
                      </p>
                      <button type="button" onClick={() => setReportPhoto(null)} className="mt-0.5 text-[11px] font-bold text-error hover:underline">
                        Remove photo
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-outline-variant bg-surface-container-low px-3 text-xs font-bold text-primary transition-colors hover:bg-surface-container ${compressingPhoto ? 'pointer-events-none opacity-60' : ''}`}>
                      {compressingPhoto ? <Icon icon="sync" size={18} className="animate-spin" /> : <Icon icon="photo_camera" size={18} />}
                      {compressingPhoto ? 'Processing photo…' : 'Take memo photo'}
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void attachReportPhoto(e)} disabled={compressingPhoto} />
                    </label>
                    <label className={`flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-outline-variant bg-surface-container-low px-3 text-xs font-bold text-primary transition-colors hover:bg-surface-container ${compressingPhoto ? 'pointer-events-none opacity-60' : ''}`}>
                      <Icon icon="add_photo_alternate" size={18} />Choose from gallery
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => void attachReportPhoto(e)} disabled={compressingPhoto} />
                    </label>
                  </div>
                )}
              </div>

              {reportError && (
                <p className="px-3 py-2 rounded-lg bg-error-container text-on-error-container font-semibold text-xs">
                  {reportError}
                </p>
              )}

              <div className="pt-2 border-t border-outline-variant flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReportGuard(null)}
                  className="px-4 py-2.5 rounded-lg bg-surface-container text-on-surface-variant font-semibold hover:bg-surface-container-high cursor-pointer text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReport || !reportDescription.trim() || !reportEventName.trim() || !reportEventDate || !reportPhoto}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-primary text-on-primary font-bold hover:bg-primary/90 cursor-pointer text-sm disabled:opacity-50"
                >
                  {submittingReport ? <Icon icon="sync" size={18} className="animate-spin" /> : <Icon icon="send" size={18} />}
                  <span>{submittingReport ? 'Filing…' : 'Submit Report'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox Image Preview Modal */}
      {previewImage && (
        <div className="overlay-enter fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="overlay-panel relative flex w-full max-w-3xl flex-col items-center">
            <div className="w-full flex items-center justify-between text-white mb-2 px-1">
              <span className="font-bold text-sm truncate">{previewImage.title}</span>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="p-1.5 rounded-lg hover:bg-white/20 text-white cursor-pointer"
                aria-label="Close photo preview"
              >
                <Icon icon="close" size={24} />
              </button>
            </div>
            <img
              src={previewImage.url}
              alt={previewImage.title}
              className="max-h-[80vh] w-auto max-w-full rounded-lg object-contain shadow-2xl"
            />
          </div>
        </div>
      )}
      {showDeleteEventDialog && musterEvent && <EventDeleteDialog
        title={`Delete “${musterEvent.event_name}”?`}
        description={`This will permanently remove the event, its selected personnel, and all attendance recorded for ${formatDay(date)} in this division.`}
        deleting={savingEvent}
        error={error || undefined}
        onCancel={() => setShowDeleteEventDialog(false)}
        onConfirm={() => void removeEvent()}
      />}
    </div>
  );
}
