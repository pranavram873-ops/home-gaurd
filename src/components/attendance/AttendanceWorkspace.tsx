'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  addMusterEventEvidencePhoto,
  addRosterGuard,
  addRosterGuards,
  compressImage,
  filePersonnelReport,
  loadAttendancePage,
  loadAttendanceEvents,
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
  type GuardDutyHistory,
  type MusterEvent,
  type RosterGuard,
} from '@/lib/services/simpleAttendanceService';
import { useDivision } from '@/lib/attendance/divisionContext';
import { useAuth } from '@/lib/auth/authContext';
import { Icon } from '@/components/ui/Icon';
import { BottomSheet, Card, Chip, Dot, EmptyState } from '@/components/ui/primitives';

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

/**
 * Duty history register inside the profile modal: Home Guard code and duty counts.
 */
function DutyHistorySection({ phone }: { phone?: string | null }) {
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

  const monthLabel = (key: string) => {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  };

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
          {showHistory && (
            <ul className="px-4 py-2 flex flex-col">
              {history.months.slice(1).map((bucket) => (
                <li key={bucket.month} className="flex items-center justify-between py-1.5 text-[13px]">
                  <span className="font-semibold text-on-surface-variant">{monthLabel(bucket.month)}</span>
                  <span className="tabular-nums">
                    <strong className="text-primary">{bucket.present}</strong>
                    <span className="text-outline"> present</span>
                    {bucket.absent > 0 && (
                      <>
                        <span className="text-outline"> · </span>
                        <strong className="text-on-error-container">{bucket.absent}</strong>
                        <span className="text-outline"> absent</span>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="px-4 py-2.5">
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-primary font-bold text-xs hover:bg-surface-container-low transition-colors cursor-pointer"
            >
              <Icon icon={showHistory ? 'expand_less' : 'history'} size={16} />
              <span>{showHistory ? 'Hide history' : 'See duty history'}</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function AttendanceWorkspace({ canAddGuards: canAddGuardsProp = false }: { canAddGuards?: boolean }) {
  const { divisionId, setDivisionId } = useDivision();
  const { role } = useAuth();
  const canAddGuards = canAddGuardsProp || role === 'admin';
  const [divisions, setDivisions] = useState<AttendanceDivision[]>([]);
  const [date, setDate] = useState(todayLocal);
  const [eventMonth, setEventMonth] = useState(() => todayLocal().slice(0, 7));
  const [monthEvents, setMonthEvents] = useState<AttendanceEventSummary[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState('');

  // Event details form state
  const [eventName, setEventName] = useState('');
  const [eventAddress, setEventAddress] = useState('');
  const [musterEvent, setMusterEvent] = useState<MusterEvent | null>(null);
  const [savingEvent, setSavingEvent] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [uploadingEventPhoto, setUploadingEventPhoto] = useState(false);

  // Roster and marks state
  const [roster, setRoster] = useState<RosterGuard[]>([]);
  const [marks, setMarks] = useState<DailyMark[]>([]);
  const [bandobast, setBandobast] = useState<BandobastEvent[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Add guard roster state
  const [showAdd, setShowAdd] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [form, setForm] = useState({ full_name: '', phone: '', home_guard_code: '' });
  const [adding, setAdding] = useState(false);
  const [evidenceByGuard, setEvidenceByGuard] = useState<Record<string, { name: string; dataUrl: string }>>({});

  // Profile Modal State
  const [selectedProfileGuard, setSelectedProfileGuard] = useState<RosterGuard | null>(null);
  const [profileMemoCount, setProfileMemoCount] = useState<number | null>(null);

  // Report Modal State
  const [reportGuard, setReportGuard] = useState<RosterGuard | null>(null);
  const [reportCategory, setReportCategory] = useState('attendance');
  const [reportDescription, setReportDescription] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportError, setReportError] = useState('');

  // Image Preview Lightbox State
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    setMusterEvent(null);
    setEventName('');
    setEventAddress('');
    loadAttendancePage(divisionId, date)
      .then((data) => {
        if (!live) return;
        setDivisions(data.divisions);
        if (!divisionId && data.divisions[0]) setDivisionId(data.divisions[0].id);
        setRoster(data.roster);
        setMarks(data.marks);
        setMusterEvent(data.musterEvent);
        setEventName(data.musterEvent?.event_name ?? '');
        setEventAddress(data.musterEvent?.address ?? '');

        // Restore guard photos from database marks
        const photosFromDb: Record<string, { name: string; dataUrl: string }> = {};
        for (const mark of data.marks) {
          if (mark.photo_url) {
            photosFromDb[mark.guard_id] = { name: 'Saved Attendance Photo', dataUrl: mark.photo_url };
          }
        }
        setEvidenceByGuard(photosFromDb);
      })
      .catch((reason: unknown) => live && setError(reason instanceof Error ? reason.message : 'Could not load attendance.'))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [divisionId, date, setDivisionId]);

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
    try {
      const saved = await saveMusterEvent(divisionId, date, eventName, eventAddress);
      setMusterEvent(saved);
      setEventName(saved.event_name);
      setEventAddress(saved.address ?? '');
      setShowEventForm(false);
      setNotice(`“${saved.event_name}” event created. Upload evidence photos or mark personnel below.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save this event.');
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
      const updatedPhotos = await addMusterEventEvidencePhoto(divisionId, date, compressed);
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
      const updatedPhotos = await removeMusterEventEvidencePhoto(divisionId, date, index);
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

  const presentCount = marks.filter((mark) => mark.status === 'present').length;
  const absentCount = marks.filter((mark) => mark.status === 'absent').length;
  const pendingCount = Math.max(0, roster.length - marks.length);
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
      await saveDailyMark(guard.id, divisionId, date, status);
      setMarks((current) => {
        const prior = current.find((mark) => mark.guard_id === guard.id);
        if (prior) return current.map((mark) => mark.guard_id === guard.id ? { ...mark, status } : mark);
        return [...current, {
          id: `${guard.id}-${date}`,
          guard_id: guard.id,
          division_id: divisionId,
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

  async function syncMuster() {
    setSyncing(true);
    setError('');
    try {
      const data = await loadAttendancePage(divisionId, date);
      setRoster(data.roster);
      setMarks(data.marks);
      setNotice('Muster roll synced with HQ Command.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not reach HQ Command.');
    } finally {
      setSyncing(false);
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
      await saveGuardPhotoEvidence(guard.id, divisionId, date, compressed);
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

  async function submitGuard(event: React.FormEvent) {
    event.preventDefault();
    if (!divisionId) return;
    setAdding(true);
    setError('');
    try {
      if (bulkMode) {
        const rows = bulkText.split(/\r?\n/).map((line) => line.split('\t').map((cell) => cell.trim())).filter((cells) => cells.some(Boolean));
        const dataRows = rows[0]?.[0]?.toLowerCase().includes('name') ? rows.slice(1) : rows;
        const parsed = dataRows.map(([full_name, phone, home_guard_code]) => ({ full_name, phone, home_guard_code, division_id: divisionId }));
        if (!parsed.length || parsed.some((row) => !row.full_name || !/^[0-9]{10}$/.test(row.phone) || !row.home_guard_code)) {
          throw new Error('Check the pasted rows. Each line needs a name, a 10-digit phone number, and a Home Guard code in separate columns.');
        }
        await addRosterGuards(parsed);
        const data = await loadAttendancePage(divisionId, date);
        setRoster(data.roster);
        setMarks(data.marks);
        setBulkText('');
        setShowAdd(false);
        setNotice(`${parsed.length} Home Guards added to ${selectedDivision?.name}.`);
        return;
      }
      await addRosterGuard({ ...form, division_id: divisionId });
      const data = await loadAttendancePage(divisionId, date);
      setRoster(data.roster);
      setMarks(data.marks);
      setForm({ full_name: '', phone: '', home_guard_code: '' });
      setShowAdd(false);
      setNotice('Home Guard added to this division.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not add this Home Guard.');
    } finally {
      setAdding(false);
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
    setReportError('');
  }

  async function submitPersonnelReport(event: React.FormEvent) {
    event.preventDefault();
    if (!reportGuard || reportDescription.trim().length < 10) return;
    setSubmittingReport(true);
    setReportError('');
    try {
      await filePersonnelReport({
        guardId: reportGuard.id,
        divisionId,
        category: reportCategory,
        description: reportDescription.trim(),
      });
      setNotice(`Report successfully filed against ${reportGuard.full_name}. Command review initiated.`);
      setReportGuard(null);
    } catch (cause) {
      setReportError(cause instanceof Error ? cause.message : 'Could not submit report. Try again.');
    } finally {
      setSubmittingReport(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-3 pb-28">
      {/* Operational context banner */}
      <section className="rounded-xl bg-surface-container-low p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-label-md text-on-primary shadow-sm">
            <Icon icon="shield" size={16} fill className="text-on-secondary-container" />
            <span className="max-w-[160px] truncate">{selectedDivision?.name || 'Loading division…'}</span>
          </span>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-surface-container-highest px-3 py-1.5 text-label-md text-on-surface shadow-sm transition-colors hover:bg-surface-container-high">
            <Icon icon="calendar_today" size={16} className="text-primary" />
            <span>{formatDay(date)}</span>
            <input
              type="date"
              value={date}
              onChange={(event) => event.target.value && setDate(event.target.value)}
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

      {/* Event creation and edit card */}
      {showEventForm ? (
        <Card className="p-4 sm:p-5">
          <div className="mb-4 flex items-start justify-between gap-2 border-b border-outline-variant/50 pb-3">
            <div>
              <h2 className="text-headline-sm font-bold text-on-surface">
                {musterEvent ? 'Edit Event Details' : 'Create New Event'}
              </h2>
              <p className="text-sm text-on-surface-variant">
                Fill in event details to open muster roll and attach photo evidence.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowEventForm(false);
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
                onClick={() => setShowEventForm(false)}
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
                {savingEvent ? 'Saving Event…' : musterEvent ? 'Update Event Details' : 'Create & Show Personnel'}
              </button>
            </div>
          </form>
        </Card>
      ) : musterEvent ? (
        <Card className="p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-outline-variant/40">
            <button
              type="button"
              onClick={() => {
                setMusterEvent(null);
                setShowEventForm(false);
                setNotice('');
                setError('');
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-surface-container-high px-3 py-1.5 text-xs font-bold text-primary hover:bg-surface-container-highest transition cursor-pointer"
            >
              <Icon icon="arrow_back" size={16} />
              <span>Back to Events List</span>
            </button>
            <button
              type="button"
              onClick={() => setShowEventForm(true)}
              className="flex items-center gap-1.5 shrink-0 rounded-lg border border-outline-variant px-3 py-1.5 text-label-md font-bold text-primary hover:bg-surface-container cursor-pointer"
            >
              <Icon icon="edit" size={16} />
              <span>Edit Event</span>
            </button>
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
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary-container px-3 py-1.5 text-xs font-bold text-on-primary hover:bg-primary transition shadow-xs">
                {uploadingEventPhoto ? <Icon icon="sync" size={15} className="animate-spin" /> : <Icon icon="upload" size={15} />}
                <span>{uploadingEventPhoto ? 'Uploading…' : 'Add Event Photo'}</span>
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploadingEventPhoto}
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
              <p className="text-xs text-on-surface-variant/80 italic">
                No event evidence photos attached yet. Click Add Event Photo to upload parade/event photos for admin view.
              </p>
            )}
          </div>
        </Card>
      ) : (
        <Card className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-container text-on-primary">
              <Icon icon="event" size={22} />
            </span>
            <div>
              <h2 className="text-headline-sm font-bold text-on-surface">Create a new district event</h2>
              <p className="text-sm text-on-surface-variant">{formatDay(date)} · Enter name, date & address to manage personnel.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setError(''); setShowEventForm(true); }}
            disabled={loading || !divisionId}
            className="flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-label-md font-bold text-on-primary hover:bg-primary/90 disabled:opacity-60 sm:w-auto cursor-pointer"
          >
            <Icon icon="add" size={18} />
            Create Event
          </button>
        </Card>
      )}

      {notice && (
        <div role="status" className="flex items-start gap-2.5 rounded-lg bg-tertiary-fixed p-3 text-on-tertiary-fixed-variant">
          <Icon icon="check_circle" size={18} fill className="mt-0.5 shrink-0" />
          <span className="min-w-0 flex-1 text-sm">{notice}</span>
        </div>
      )}
      {error && (
        <div role="alert" className="flex items-start gap-2.5 rounded-lg bg-error-container p-3 text-on-error-container">
          <Icon icon="error" size={18} fill className="mt-0.5 shrink-0 text-error" />
          <span className="min-w-0 flex-1 text-sm">{error}</span>
        </div>
      )}

      {/* Roster of Home Guards in that division */}
      {musterEvent && (
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
                aria-label="Search the roster"
                placeholder="Search guard by name or HG code..."
                className="h-12 w-full rounded-xl bg-surface-container-lowest pl-10 pr-3 text-label-lg text-on-surface shadow-sm ring-primary-container placeholder:text-outline focus:outline-none focus:ring-2 sm:pr-28"
              />
              {canAddGuards && (
                <button
                  type="button"
                  onClick={() => { setError(''); setNotice(''); setBulkMode(false); setShowAdd(true); }}
                  className="absolute inset-y-1.5 right-1.5 hidden items-center gap-1.5 rounded-lg bg-primary-container px-3 text-label-md text-on-primary hover:bg-primary sm:flex"
                >
                  <Icon icon="add" size={18} />
                  Add guards
                </button>
              )}
            </div>
            {canAddGuards && (
              <button
                type="button"
                onClick={() => { setError(''); setNotice(''); setBulkMode(false); setShowAdd(true); }}
                className="mt-2 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-primary-container px-3 text-label-md text-on-primary active:scale-[0.99] sm:hidden"
              >
                <Icon icon="add" size={18} />
                Add / paste roster
              </button>
            )}
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
              body={canAddGuards ? 'Use Add guards to start building the roster.' : 'Ask an administrator to add the division roster.'}
            />
          ) : filteredRoster.length === 0 ? (
            <p className="p-8 text-center text-sm text-on-surface-variant">No Home Guards match that search.</p>
          ) : (
            <ul className="flex flex-col gap-2 p-3 sm:p-4">
              {filteredRoster.map((guard) => {
                const mark = markByGuard.get(guard.id);
                const isSaving = savingId === guard.id;
                const guardPhoto = evidenceByGuard[guard.id]?.dataUrl || mark?.photo_url;
                return (
                  <li key={guard.id} className="rounded-xl bg-surface-container-low p-3.5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => void openProfileModal(guard)}
                        className="flex min-w-0 items-center gap-3 text-left transition hover:opacity-85 cursor-pointer group"
                        title="Click to view full personnel profile"
                      >
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary font-extrabold text-sm shadow-xs group-hover:scale-105 transition-transform">
                          {initials(guard.full_name)}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-base font-bold text-on-surface group-hover:text-primary transition-colors">
                              {guard.full_name}
                            </p>
                            <Icon icon="info" size={16} className="text-primary shrink-0 opacity-70 group-hover:opacity-100" />
                          </div>
                          <div className="mt-0.5 flex items-center gap-2">
                            <span className="truncate font-mono text-xs font-extrabold tracking-wider text-primary">
                              {guard.home_guard_code}
                            </span>
                            <span className="truncate text-xs text-on-surface-variant">• {guard.phone}</span>
                          </div>
                        </div>
                      </button>

                      <div className="flex items-center gap-2 shrink-0">
                        {mark?.status === 'present' ? (
                          <Chip tone="present" icon="check_circle" className="!text-[13px]">Present</Chip>
                        ) : mark?.status === 'absent' ? (
                          <Chip tone="absent" icon="cancel" className="!text-[13px]">Absent</Chip>
                        ) : (
                          <Chip tone="pending" className="!text-[13px]">Not marked</Chip>
                        )}
                        <button
                          type="button"
                          onClick={() => openReportModal(guard)}
                          className="flex items-center gap-1 rounded-lg bg-error-container/70 hover:bg-error-container px-2.5 py-1.5 text-xs font-bold text-on-error-container transition cursor-pointer"
                          title={`Report ${guard.full_name}`}
                        >
                          <Icon icon="report_problem" size={15} className="text-error shrink-0" />
                          <span>Report</span>
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 grid w-full grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={isSaving || !musterEvent}
                        aria-pressed={mark?.status === 'present'}
                        onClick={() => void changeStatus(guard, 'present')}
                        className={`flex h-11 items-center justify-center gap-1.5 rounded-lg text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer ${
                          mark?.status === 'present'
                            ? 'bg-on-tertiary-container text-on-tertiary shadow-sm'
                            : 'bg-surface-container-high text-on-surface hover:bg-on-tertiary-container hover:text-on-tertiary'
                        }`}
                      >
                        {isSaving && mark?.status !== 'present' ? <Icon icon="sync" size={18} className="animate-spin" /> : <Icon icon="check" size={18} />}
                        <span>Present</span>
                      </button>
                      <button
                        type="button"
                        disabled={isSaving || !musterEvent}
                        aria-pressed={mark?.status === 'absent'}
                        onClick={() => void changeStatus(guard, 'absent')}
                        className={`flex h-11 items-center justify-center gap-1.5 rounded-lg text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer ${
                          mark?.status === 'absent'
                            ? 'bg-error text-on-error shadow-sm'
                            : 'bg-surface-container-high text-on-surface hover:bg-error hover:text-on-error'
                        }`}
                      >
                        {isSaving && mark?.status !== 'absent' ? <Icon icon="sync" size={18} className="animate-spin" /> : <Icon icon="close" size={18} />}
                        <span>Absent</span>
                      </button>
                    </div>

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
      )}

      {/* Events this month card - only shown when NOT inside an active event */}
      {!musterEvent && (
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-outline-variant/60 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
            <div><h2 className="text-headline-sm font-bold text-on-surface">Events this month</h2><p className="text-sm text-on-surface-variant">Events for {selectedDivision?.name ?? 'this district'}.</p></div>
            <label className="flex min-h-10 items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-label-md text-on-surface">
              <Icon icon="calendar_month" size={18} className="text-primary" />
              <span className="sr-only">Choose event month</span>
              <input type="month" value={eventMonth} max={todayLocal().slice(0, 7)} onChange={(event) => event.target.value && setEventMonth(event.target.value)} className="min-w-0 bg-transparent text-sm outline-none" aria-label="Choose event month" />
            </label>
          </div>
          <div className="space-y-2 p-3 sm:p-4">
            {eventsError ? <p role="alert" className="rounded-lg bg-error-container p-3 text-sm text-on-error-container">{eventsError}</p> : eventsLoading ? <p className="py-6 text-center text-sm text-on-surface-variant">Loading events…</p> : monthEvents.length ? monthEvents.map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => {
                  setDate(event.date);
                  setShowEventForm(false);
                  setLoading(true);
                  loadAttendancePage(divisionId, event.date)
                    .then((data) => {
                      let evt = data.musterEvent;
                      if (!evt) {
                        evt = {
                          id: `muster-${divisionId}-${event.date}`,
                          division_id: divisionId,
                          event_date: event.date,
                          event_name: event.eventName || `${formatDay(event.date)} Muster`,
                          created_by: '',
                          created_at: new Date().toISOString(),
                          updated_at: new Date().toISOString(),
                        };
                      }
                      setMusterEvent(evt);
                      setEventName(evt.event_name);
                      setEventAddress(evt.address ?? '');
                      setRoster(data.roster);
                      setMarks(data.marks);
                    })
                    .catch((cause) => {
                      setError(cause instanceof Error ? cause.message : 'Could not load event.');
                    })
                    .finally(() => setLoading(false));
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

      {/* Sticky tally bar */}
      {musterEvent && (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 bg-surface-container-lowest/95 px-4 py-2.5 shadow-[0_-8px_28px_rgba(0,0,0,.5)] backdrop-blur-md lg:bottom-0 lg:left-[264px]">
          <div className="mx-auto flex max-w-lg items-center justify-between gap-2 sm:max-w-[1440px]">
            <div className="min-w-0">
              <div className="flex items-center gap-1 text-[13px] font-bold text-on-surface-variant">
                <span className="text-on-tertiary-container"><strong className="tabular-nums">{presentCount}</strong> Pres</span>
                <span>•</span>
                <span className="text-error"><strong className="tabular-nums">{absentCount}</strong> Abs</span>
                <span>•</span>
                <span><strong className="tabular-nums">{pendingCount}</strong> Left</span>
              </div>
              <div className="mt-0.5 flex items-center gap-1">
                <Dot className="!h-1.5 !w-1.5 bg-tertiary-fixed-dim" />
                <span className="truncate text-xs uppercase tracking-wider text-on-surface-variant">
                  {syncing ? 'Refreshing attendance…' : 'Each attendance choice saves immediately'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void syncMuster()}
              disabled={syncing || loading}
              className="flex h-12 shrink-0 items-center gap-2 rounded-xl bg-primary-container px-4 text-label-lg text-on-primary shadow-md transition-all hover:bg-primary active:scale-95 disabled:opacity-60 disabled:active:scale-100 cursor-pointer"
            >
              {syncing ? (
                <>
                  <Icon icon="sync" size={20} className="animate-spin" />
                  <span>Refreshing…</span>
                </>
              ) : (
                <>
                  <span>Refresh attendance</span>
                  <Icon icon="refresh" size={20} />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Add Personnel Modal */}
      <BottomSheet
        open={showAdd && canAddGuards}
        onClose={() => setShowAdd(false)}
        title="Add Home Guard"
        description={selectedDivision ? `Adding to ${selectedDivision.name}` : undefined}
      >
        <form onSubmit={(event) => void submitGuard(event)} className="space-y-4">
          <div role="group" aria-label="Add mode" className="grid grid-cols-2 gap-1 rounded-xl bg-surface-container p-1">
            <button
              type="button"
              onClick={() => setBulkMode(false)}
              aria-pressed={!bulkMode}
              className={`h-10 rounded-lg text-label-md transition-colors ${!bulkMode ? 'bg-surface-container-lowest text-primary-container shadow-sm' : 'text-on-surface-variant'}`}
            >
              Add one
            </button>
            <button
              type="button"
              onClick={() => setBulkMode(true)}
              aria-pressed={bulkMode}
              className={`h-10 rounded-lg text-label-md transition-colors ${bulkMode ? 'bg-surface-container-lowest text-primary-container shadow-sm' : 'text-on-surface-variant'}`}
            >
              Paste roster
            </button>
          </div>
          {bulkMode ? (
            <>
              <div className="rounded-lg bg-primary-fixed px-3 py-2.5 text-sm text-on-primary-fixed">
                Copy three columns from a spreadsheet and paste below: <strong>Name · Phone · Home Guard code</strong>
              </div>
              <textarea
                required
                rows={8}
                value={bulkText}
                onChange={(event) => setBulkText(event.target.value)}
                placeholder={'Name\tPhone\tHome Guard code\nRavi Kumar\t9876543210\tHG-001'}
                className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest p-3 font-mono text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary-container"
              />
              <p className="text-xs text-on-surface-variant">{bulkText.trim() ? `${bulkText.trim().split(/\r?\n/).filter(Boolean).length} rows pasted` : 'One Home Guard per line. Tab-separated columns.'}</p>
            </>
          ) : (
            <>
              <label className="block text-label-md text-on-surface">
                Full name
                <input
                  required
                  autoFocus
                  maxLength={120}
                  value={form.full_name}
                  onChange={(event) => setForm({ ...form, full_name: event.target.value })}
                  className="mt-1.5 h-12 w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 text-body-md text-base text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary-container"
                />
              </label>
              <label className="block text-label-md text-on-surface">
                Phone number
                <input
                  required
                  inputMode="numeric"
                  pattern="[0-9]{10}"
                  maxLength={10}
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value.replace(/\D/g, '') })}
                  placeholder="10 digit mobile number"
                  className="mt-1.5 h-12 w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 text-body-md text-base text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary-container"
                />
              </label>
              <label className="block text-label-md text-on-surface">
                Home Guard code
                <input
                  required
                  maxLength={40}
                  value={form.home_guard_code}
                  onChange={(event) => setForm({ ...form, home_guard_code: event.target.value.toUpperCase() })}
                  className="mt-1.5 h-12 w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 text-body-md text-base uppercase text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary-container"
                />
              </label>
            </>
          )}
          <button
            disabled={adding}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-label-lg text-base text-on-primary shadow-md transition-transform active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100 cursor-pointer"
          >
            {adding ? <Icon icon="sync" size={20} className="animate-spin" /> : <Icon icon="person_add" size={20} />}
            <span>{adding ? 'Adding…' : bulkMode ? 'Add pasted Home Guards' : 'Add to roster'}</span>
          </button>
        </form>
      </BottomSheet>

      {/* Personnel Profile Modal */}
      {selectedProfileGuard && (
        <div className="fixed inset-0 bg-surface-container/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-xl max-w-sm w-full shadow-2xl border border-outline-variant overflow-hidden flex flex-col max-h-[90vh]">
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
                <span className="text-outline font-bold uppercase tracking-wider text-xs">Service Number</span>
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
        <div className="fixed inset-0 bg-surface-container/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-xl max-w-md w-full shadow-2xl border border-outline-variant overflow-hidden flex flex-col">
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

            <form onSubmit={(e) => void submitPersonnelReport(e)} className="p-5 flex flex-col gap-4 text-xs">
              <div className="rounded-lg bg-primary-fixed p-3 text-xs text-on-primary-fixed">
                <strong>{reportGuard.full_name}</strong>
                <span className="block text-on-primary-fixed/80 mt-0.5 font-mono">
                  HG Code: {reportGuard.home_guard_code} • {selectedDivision?.name}
                </span>
              </div>

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
                  Incident Description (Min. 10 characters)
                </label>
                <textarea
                  id="report-description"
                  required
                  minLength={10}
                  maxLength={4000}
                  rows={4}
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  placeholder="Describe the incident or reason for filing this report..."
                  className="w-full p-3 border border-outline-variant rounded-lg text-on-surface bg-surface-container-lowest text-sm focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-outline"
                />
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
                  disabled={submittingReport || reportDescription.trim().length < 10}
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="relative max-w-3xl w-full flex flex-col items-center">
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
    </div>
  );
}
