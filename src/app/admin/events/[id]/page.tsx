'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { Card, EmptyState, SegmentedFilter } from '@/components/ui/primitives';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { HomeGuardProfileLink } from '@/components/attendance/HomeGuardProfileLink';
import {
  addMusterEventEvidencePhoto,
  getMusterEventParticipants,
  compressImage,
  filePersonnelReport,
  loadAttendancePage,
  parseAttendanceEventId,
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

type Filter = 'all' | 'present' | 'absent';

function GuardRow({
  guard,
  mark,
  onImageClick,
  onMarkStatus,
  selectedForEvent,
  onToggleEvent,
  onFileReport,
  isSaving,
}: {
  guard: RosterGuard;
  mark?: DailyMark;
  onImageClick?: (url: string, title: string) => void;
  onMarkStatus?: (guard: RosterGuard, status: 'present' | 'absent') => void;
  selectedForEvent: boolean;
  onToggleEvent: (guard: RosterGuard) => void;
  onFileReport: (guard: RosterGuard) => void;
  isSaving?: boolean;
}) {
  const present = mark?.status === 'present';
  const absent = mark?.status === 'absent';
  return (
    <li className="card-hover-lift flex flex-col gap-2.5 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-3.5 shadow-card transition-all duration-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold shadow-xs transition-transform duration-200 hover:scale-105 ${
              absent ? 'bg-error-container text-on-error-container' : 'bg-primary-fixed text-on-primary-fixed'
            }`}
          >
            {initials(guard.full_name)}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <HomeGuardProfileLink code={guard.home_guard_code} name={guard.full_name} className="truncate text-left text-[16px] font-semibold text-primary transition-colors duration-200 hover:underline">
                {guard.full_name}
              </HomeGuardProfileLink>
              <span className="shrink-0 rounded bg-surface-container px-1.5 py-0.5 font-mono text-[13px] text-on-surface">{guard.home_guard_code}</span>
              {selectedForEvent && (
                <button type="button" onClick={() => onFileReport(guard)} className="inline-flex min-h-7 shrink-0 items-center gap-1 rounded-md px-1.5 text-xs font-semibold text-error hover:bg-error-container" aria-label={`Report ${guard.full_name}`}>
                  <Icon icon="report_problem" size={15} />
                  <span>Report</span>
                </button>
              )}
            </div>
            <span className="text-label-sm text-on-surface-variant">{guard.phone}</span>
          </div>
        </div>
        {present && selectedForEvent ? (
          <span className="animate-check-pop inline-flex shrink-0 items-center gap-1 rounded-full bg-tertiary-fixed px-2 py-0.5 text-label-sm font-bold text-on-tertiary-fixed">
            <Icon icon="check" size={13} fill />
            {mark ? formatTime(mark.marked_at) : 'Present'}
          </span>
        ) : absent && selectedForEvent ? (
          <span className="animate-check-pop inline-flex shrink-0 items-center gap-1 rounded-full bg-error-container px-2 py-0.5 text-label-sm font-bold text-on-error-container">
            <Icon icon="close" size={13} />
            Absent
          </span>
        ) : selectedForEvent ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary-fixed px-2 py-0.5 text-label-sm font-bold text-on-secondary-fixed-variant">
            <Icon icon="pending" size={13} />
            In event · not marked
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center rounded-full bg-surface-container px-2 py-0.5 text-label-sm font-bold uppercase text-on-surface-variant">
            Not in event
          </span>
        )}
      </div>

      <button type="button" onClick={() => onToggleEvent(guard)} className={`flex min-h-10 w-full items-center justify-center gap-2 rounded-lg text-sm font-bold transition-all duration-200 active:scale-[0.98] ${selectedForEvent ? 'bg-error-container text-on-error-container' : 'bg-primary-container text-on-primary'}`}>
        <Icon icon={selectedForEvent ? 'person_remove' : 'person_add'} size={18} />{selectedForEvent ? 'Remove from event' : 'Add to event'}
      </button>
      {selectedForEvent && <div className="mt-1 grid w-full grid-cols-2 gap-2">
        <button type="button" disabled={isSaving} aria-pressed={present} onClick={() => onMarkStatus?.(guard, 'present')} className={`flex h-10 items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition-all duration-200 active:scale-[0.98] disabled:opacity-60 ${present ? 'bg-on-tertiary-container text-on-tertiary shadow-sm' : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'}`}>
          {isSaving && !present ? <Icon icon="sync" size={16} className="animate-spin" /> : <Icon icon="check" size={16} className={present ? 'animate-check-pop' : ''} />} Present
        </button>
        <button type="button" disabled={isSaving} aria-pressed={absent} onClick={() => onMarkStatus?.(guard, 'absent')} className={`flex h-10 items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition-all duration-200 active:scale-[0.98] disabled:opacity-60 ${absent ? 'bg-error text-on-error shadow-sm' : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'}`}>
          {isSaving && !absent ? <Icon icon="sync" size={16} className="animate-spin" /> : <Icon icon="close" size={16} className={absent ? 'animate-check-pop' : ''} />} Absent
        </button>
      </div>}

      {mark?.photo_url && (
        <div className="flex items-center gap-2.5 rounded-lg bg-surface-container-low p-2 border border-outline-variant/40">
          <img
            src={mark.photo_url}
            alt={`${guard.full_name} attendance evidence`}
            className="h-12 w-16 object-cover rounded-md cursor-pointer hover:scale-105 transition-transform"
            onClick={() => onImageClick?.(mark.photo_url!, `${guard.full_name} (${guard.home_guard_code}) - Photo Evidence`)}
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-primary flex items-center gap-1">
              <Icon icon="verified" size={14} className="text-tertiary shrink-0" />
              Guard Photo Evidence Attached
            </p>
            <p className="text-[11px] text-on-surface-variant truncate">Click thumbnail to inspect full photo</p>
          </div>
        </div>
      )}
    </li>
  );
}

export default function AdminEventDetailsPage() {
  const params = useParams<{ id: string }>();
  const rawId = Array.isArray(params?.id) ? params.id[0] : params?.id ?? '';
  const parsed = useMemo(() => parseAttendanceEventId(rawId), [rawId]);

  const [roster, setRoster] = useState<RosterGuard[]>([]);
  const [marks, setMarks] = useState<DailyMark[]>([]);
  const [divisionName, setDivisionName] = useState('');
  const [musterEvent, setMusterEvent] = useState<MusterEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [reportGuard, setReportGuard] = useState<RosterGuard | null>(null);
  const [reportCategory, setReportCategory] = useState('attendance');
  const [reportDescription, setReportDescription] = useState('');
  const [reportPhoto, setReportPhoto] = useState<string | null>(null);
  const [reportError, setReportError] = useState('');
  const [reportSuccess, setReportSuccess] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [uploadingEventPhoto, setUploadingEventPhoto] = useState(false);
  const [eventPhotoError, setEventPhotoError] = useState('');
  const [eventPhotoNotice, setEventPhotoNotice] = useState('');

  useEffect(() => {
    if (!parsed) {
      setLoading(false);
      setError('This muster record link is not valid.');
      return;
    }
    let live = true;
    setLoading(true);
    setError('');
    loadAttendancePage(parsed.divisionId, parsed.date)
      .then(async (data) => {
        if (!live) return;
        setRoster(data.roster);
        setMarks(data.marks);
        setMusterEvent(data.musterEvent);
        if (data.musterEvent) setParticipantIds(await getMusterEventParticipants(data.musterEvent.id));
        setDivisionName(data.divisions.find((division) => division.id === parsed.divisionId)?.name ?? 'Division');
      })
      .catch((reason: unknown) => live && setError(reason instanceof Error ? reason.message : 'Could not load this record.'))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [parsed]);

  /**
   * Quick add/remove from the roster list. Adding a guard makes them an event
   * participant and stamps them present; removing one drops the participant
   * row and stamps them absent, matching the picker's save semantics.
   */
  async function toggleEventParticipant(guard: RosterGuard) {
    if (!musterEvent || !parsed) return;
    const add = !participantIds.includes(guard.id);
    const want: DailyMark['status'] = add ? 'present' : 'absent';
    const priorStatus = markByGuard.get(guard.id)?.status;
    setParticipantIds((current) => add ? [...current, guard.id] : current.filter((id) => id !== guard.id));
    setSavingId(guard.id);
    try {
      await setMusterEventParticipant(musterEvent.id, guard.id, add);
      if (priorStatus !== want) {
        await saveDailyMark(guard.id, parsed.divisionId, parsed.date, want);
        const markedAt = new Date().toISOString();
        setMarks((current) => {
          const prior = current.find((mark) => mark.guard_id === guard.id);
          if (prior) {
            return current.map((mark) => (mark.guard_id === guard.id ? { ...mark, status: want, marked_at: markedAt } : mark));
          }
          return [
            ...current,
            {
              id: `${guard.id}-${parsed.date}`,
              guard_id: guard.id,
              division_id: parsed.divisionId,
              attendance_date: parsed.date,
              status: want,
              marked_at: markedAt,
            },
          ];
        });
      }
    } catch (cause) {
      setParticipantIds((current) => add ? current.filter((id) => id !== guard.id) : [...current, guard.id]);
      setError(cause instanceof Error ? cause.message : 'Could not update event personnel.');
    } finally {
      setSavingId(null);
    }
  }

  async function changeStatus(guard: RosterGuard, status: 'present' | 'absent') {
    if (!parsed) return;
    setSavingId(guard.id);
    try {
      await saveDailyMark(guard.id, parsed.divisionId, parsed.date, status);
      setMarks((current) => {
        const prior = current.find((m) => m.guard_id === guard.id);
        if (prior) return current.map((m) => (m.guard_id === guard.id ? { ...m, status } : m));
        return [
          ...current,
          {
            id: `${guard.id}-${parsed.date}`,
            guard_id: guard.id,
            division_id: parsed.divisionId,
            attendance_date: parsed.date,
            status,
            marked_at: new Date().toISOString(),
          },
        ];
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save attendance mark.');
    } finally {
      setSavingId(null);
    }
  }

  function openReport(guard: RosterGuard) {
    setReportGuard(guard);
    setReportCategory('attendance');
    setReportDescription('');
    setReportPhoto(null);
    setReportError('');
  }

  async function attachReportPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setReportError('');
    try {
      setReportPhoto(await compressImage(file, 1200, 1200, 0.8));
    } catch {
      setReportError('Could not process that photo. Please choose another image.');
    }
  }

  async function uploadEventPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !parsed || !musterEvent) return;
    setUploadingEventPhoto(true);
    setEventPhotoError('');
    setEventPhotoNotice('');
    try {
      const compressed = await compressImage(file, 1200, 1200, 0.8);
      const photos = await addMusterEventEvidencePhoto(parsed.divisionId, parsed.date, compressed);
      setMusterEvent((current) => current ? { ...current, evidence_photos: photos } : current);
      setEventPhotoNotice('Event photo added.');
    } catch (cause) {
      setEventPhotoError(cause instanceof Error ? cause.message : 'Could not add the event photo.');
    } finally {
      setUploadingEventPhoto(false);
    }
  }

  async function submitReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reportGuard || !parsed || reportDescription.trim().length < 10) return;
    setSubmittingReport(true);
    setReportError('');
    try {
      await filePersonnelReport({
        guardId: reportGuard.id,
        divisionId: parsed.divisionId,
        category: reportCategory,
        description: reportDescription.trim(),
        evidencePhoto: reportPhoto,
      });
      setReportSuccess(`Report filed for ${reportGuard.full_name}.`);
      setReportGuard(null);
      setReportPhoto(null);
    } catch (cause) {
      setReportError(cause instanceof Error ? cause.message : 'Could not file the report. Please try again.');
    } finally {
      setSubmittingReport(false);
    }
  }

  const markByGuard = useMemo(() => new Map(marks.map((mark) => [mark.guard_id, mark])), [marks]);

  /**
   * Effective muster status for one roster guard. Only event participants can
   * be present; everyone else - and participants not yet marked - falls into
   * the absent/pending buckets the muster counts.
   */
  const statusOf = (guard: RosterGuard): 'present' | 'absent' | 'pending' => {
    if (!participantIds.includes(guard.id)) return 'absent';
    return markByGuard.get(guard.id)?.status ?? 'pending';
  };

  const eventGuards = useMemo(() => roster.filter((guard) => participantIds.includes(guard.id)), [roster, participantIds]);
  const presentCount = eventGuards.filter((guard) => statusOf(guard) === 'present').length;
  const pendingCount = eventGuards.filter((guard) => statusOf(guard) === 'pending').length;
  const absentCount = eventGuards.length - presentCount - pendingCount;
  const sanctionedCount = eventGuards.length;
  const presentPct = sanctionedCount ? Math.round((presentCount / sanctionedCount) * 100) : 0;
  const absentPct = sanctionedCount ? Math.round((absentCount / sanctionedCount) * 100) : 0;
  const isOpen = parsed ? parsed.date >= todayISO() : false;

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return roster.filter((guard) => {
      const matchesFilter = filter === 'all' || statusOf(guard) === filter;
      const matchesSearch = !term || `${guard.full_name} ${guard.home_guard_code}`.toLowerCase().includes(term);
      return participantIds.includes(guard.id) && matchesFilter && matchesSearch;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster, filter, search, markByGuard, participantIds]);

  return (
    <DashboardLayout title="Muster Record" subtitle="Admin event details">
      <div className="mx-auto max-w-2xl pb-10">
      {/* Return link */}
      <div className="flex items-center justify-between rounded bg-surface-container-low px-4 py-2 shadow-sm">
        <Link href="/admin/dashboard" className="flex items-center gap-1 text-label-md font-bold text-primary active:opacity-75">
          <Icon icon="arrow_back" size={18} />
          Back to Events List
        </Link>
        <div className="flex items-center gap-1.5 rounded-full bg-surface-container px-2 py-1">
          <Icon icon="fingerprint" size={14} className="text-on-surface-variant" />
          <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">{parsed ? formatDay(parsed.date) : '—'}</span>
        </div>
      </div>

      {error ? (
        <div role="alert" className="mt-4 flex items-start gap-2.5 rounded-lg bg-error-container p-3 text-on-error-container">
          <Icon icon="error" size={20} fill className="mt-0.5 shrink-0 text-error" />
          <span className="min-w-0 flex-1 text-sm">{error}</span>
        </div>
      ) : (
        <>
          {reportSuccess && (
            <div role="status" className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-tertiary-fixed px-3 py-2 text-sm text-on-tertiary-fixed">
              <span>{reportSuccess}</span>
              <button type="button" onClick={() => setReportSuccess('')} aria-label="Dismiss report confirmation" className="rounded p-1 hover:bg-black/5">
                <Icon icon="close" size={17} />
              </button>
            </div>
          )}
          {/* Header */}
          <section className="px-1 pt-4">
            <div className="mb-1 flex items-start justify-between gap-2">
              <h2 className="text-headline-md font-bold leading-snug tracking-tight text-primary">
                {musterEvent?.event_name || `${divisionName || 'Muster'} ${parsed ? formatDay(parsed.date) : ''}`}
              </h2>
              <span
                className={`inline-flex shrink-0 items-center gap-1 rounded px-2.5 py-1 text-label-sm font-bold tracking-wide ${
                  isOpen ? 'bg-secondary-fixed text-on-secondary-fixed-variant' : 'bg-surface-container-highest text-on-surface'
                }`}
              >
                <span className={`inline-block h-2 w-2 rounded-full ${isOpen ? 'bg-secondary' : 'bg-error'}`} aria-hidden />
                {isOpen ? 'MUSTER OPEN' : 'MUSTER CLOSED'}
              </span>
            </div>
            <div className="flex flex-col gap-1 text-label-md text-on-surface-variant">
              <div className="flex items-center gap-1.5">
                <Icon icon="domain" size={16} className="text-primary" />
                <span>{divisionName} Division</span>
              </div>
              {parsed && (
                <div className="flex items-center gap-1.5">
                  <Icon icon="schedule" size={16} className="text-secondary" />
                  <span>{formatDay(parsed.date)}</span>
                </div>
              )}
              {musterEvent?.address && (
                <div className="flex items-center gap-1.5 text-xs">
                  <Icon icon="location_on" size={16} className="shrink-0 text-primary" />
                  <span>{musterEvent.address}</span>
                </div>
              )}
            </div>
          </section>
          {!musterEvent ? null : <div className="mt-3 flex items-center justify-between rounded-xl bg-surface-container-low p-3">
            <span className="text-sm font-semibold text-on-surface">{participantIds.length} guard{participantIds.length === 1 ? '' : 's'} in this event</span>
            <div className="flex items-center gap-2">
              <Link href={`/admin/events/${rawId}/personnel`} className="flex min-h-10 items-center gap-2 rounded-lg bg-primary-container px-3 text-sm font-bold text-on-primary"><Icon icon="person_add" size={18} />Add personnel</Link>
            </div>
          </div>}

          {/* Metrics */}
          <section className="px-1 py-2">
            <div className="grid grid-cols-3 gap-1">
              <Card className="flex flex-col justify-between p-3">
                <div className="mb-1 flex items-center justify-between text-on-tertiary-container"><span className="text-label-sm font-bold uppercase">Present</span><Icon icon="check_circle" size={18} fill /></div>
                <div><span className="text-headline-lg tracking-tight text-primary">{loading ? '—' : presentCount}</span><p className="mt-0.5 text-label-sm font-semibold text-on-tertiary-container">{presentPct}%</p></div>
              </Card>
              <Card className="flex flex-col justify-between p-3">
                <div className="mb-1 flex items-center justify-between text-error"><span className="text-label-sm font-bold uppercase">Absent</span><Icon icon="cancel" size={18} fill /></div>
                <div><span className="text-headline-lg tracking-tight text-error">{loading ? '—' : absentCount}</span><p className="mt-0.5 text-label-sm font-semibold text-error">{absentPct}%</p></div>
              </Card>
              <Card className="flex flex-col justify-between p-3">
                <div className="mb-1 flex items-center justify-between text-on-surface-variant"><span className="text-label-sm font-bold uppercase">Total Guards</span><Icon icon="groups" size={18} /></div>
                <div><span className="text-headline-lg tracking-tight text-primary">{loading ? '—' : sanctionedCount}</span><p className="mt-0.5 text-label-sm font-medium text-on-surface-variant">Guards</p></div>
              </Card>
            </div>
          </section>

          {/* Evidence Photos Section */}
          <section className="px-1 py-2">
            <Card className="p-3.5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-label-sm font-bold uppercase tracking-wider text-primary"><Icon icon="add_a_photo" size={18} /><span>Event Photo Evidence ({(musterEvent?.evidence_photos || []).length} Attached)</span></div>
                {musterEvent && <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary-container px-3 py-1.5 text-xs font-bold text-on-primary shadow-xs transition hover:bg-primary">
                  {uploadingEventPhoto ? <Icon icon="sync" size={15} className="animate-spin" /> : <Icon icon="upload" size={15} />}
                  <span>{uploadingEventPhoto ? 'Uploading…' : 'Add Event Photo'}</span>
                  <input type="file" accept="image/*" disabled={uploadingEventPhoto} className="hidden" onChange={(event) => void uploadEventPhoto(event)} />
                </label>}
              </div>
              {eventPhotoNotice && <p role="status" className="mb-2 rounded-lg bg-tertiary-fixed px-3 py-2 text-xs text-on-tertiary-fixed">{eventPhotoNotice}</p>}
              {eventPhotoError && <p role="alert" className="mb-2 rounded-lg bg-error-container px-3 py-2 text-xs text-on-error-container">{eventPhotoError}</p>}
              {(musterEvent?.evidence_photos || []).length > 0 ? (
                <div className="flex flex-wrap gap-2.5 mt-2">
                  {musterEvent!.evidence_photos!.map((photoUrl, idx) => (
                    <div key={idx} className="h-20 w-24 rounded-lg overflow-hidden border border-outline-variant bg-surface-container shadow-xs">
                      <img
                        src={photoUrl}
                        alt={`Event evidence ${idx + 1}`}
                        className="h-full w-full object-cover cursor-pointer hover:scale-105 transition-transform"
                        onClick={() => setPreviewImage({ url: photoUrl, title: `Event Evidence Photo #${idx + 1}` })}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-1 text-xs italic text-on-surface-variant">
                  No event evidence photos attached yet for this muster.
                </p>
              )}
            </Card>
          </section>

          {/* Roster */}
          <section className="px-1 py-2">
            <div className="mb-1 flex items-baseline justify-between">
              <h3 className="text-headline-sm font-bold text-primary">Event Personnel</h3>
              <span className="text-label-sm font-bold uppercase text-on-surface-variant">Total {sanctionedCount}</span>
            </div>
            <SegmentedFilter<Filter>
              label="Filter by status"
              value={filter}
              onChange={setFilter}
              className="mb-3 bg-surface-container-high"
              options={[
                { value: 'all', label: 'All', count: sanctionedCount },
                { value: 'present', label: 'Present', count: presentCount },
                { value: 'absent', label: 'Absent', count: absentCount },
              ]}
            />
            <div className="relative mb-3">
              <Icon icon="search" size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                type="search"
                aria-label="Search guard name or HG code"
                placeholder="Search guard name or HG code..."
            className="w-full rounded-xl bg-surface-container-lowest py-2.5 pl-10 pr-3 text-body-md text-on-surface shadow-sm ring-primary/20 placeholder:text-outline focus:outline-none focus:ring-2"
              />
            </div>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-on-surface-variant">
                <Icon icon="sync" size={20} className="animate-spin" />
                Loading record…
              </div>
            ) : visible.length === 0 ? (
              <EmptyState icon="person_search" title="No personnel added yet" body='Use "Add personnel" above to assign Home Guards to this event.' />
            ) : (
              <ul className="stagger-in flex flex-col gap-2.5">
              {visible.map((guard) => (
                  <GuardRow
                    key={guard.id}
                    guard={guard}
                    mark={markByGuard.get(guard.id)}
                    isSaving={savingId === guard.id}
                    selectedForEvent={participantIds.includes(guard.id)}
                    onToggleEvent={(g) => void toggleEventParticipant(g)}
                    onFileReport={openReport}
                    onMarkStatus={(g, status) => void changeStatus(g, status)}
                    onImageClick={(url, title) => setPreviewImage({ url, title })}
                  />
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {reportGuard && (
        <div className="overlay-enter fixed inset-0 z-50 flex items-center justify-center bg-surface-container/50 p-4 backdrop-blur-xs" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setReportGuard(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="admin-event-report-title" className="overlay-panel flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-2xl">
            <header className="flex items-center justify-between bg-primary p-4 text-on-primary">
              <div className="flex items-center gap-2">
                <Icon icon="report_problem" size={20} />
                <h3 id="admin-event-report-title" className="text-sm font-bold">File personnel report</h3>
              </div>
              <button type="button" onClick={() => setReportGuard(null)} aria-label="Close report form" className="rounded-md p-1 hover:bg-white/10">
                <Icon icon="close" size={20} />
              </button>
            </header>
            <form onSubmit={(event) => void submitReport(event)} className="flex flex-col gap-4 overflow-y-auto p-5">
              <div className="rounded-lg bg-primary-fixed p-3 text-sm text-on-primary-fixed">
                <strong>{reportGuard.full_name}</strong>
                <span className="mt-0.5 block font-mono text-xs text-on-primary-fixed/80">{reportGuard.home_guard_code} · {divisionName} · {parsed ? formatDay(parsed.date) : ''}</span>
              </div>
              <label className="block text-xs font-bold text-on-surface-variant">
                Report category
                <select value={reportCategory} onChange={(event) => setReportCategory(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm font-normal text-on-surface">
                  <option value="attendance">Late / absent from duty</option>
                  <option value="conduct">Conduct or insubordination</option>
                  <option value="safety">Safety concern</option>
                  <option value="other">Other concern</option>
                </select>
              </label>
              <label htmlFor="admin-event-report-description" className="block text-xs font-bold text-on-surface-variant">
                Incident description <span className="font-normal">(at least 10 characters)</span>
                <textarea id="admin-event-report-description" required minLength={10} maxLength={4000} rows={4} value={reportDescription} onChange={(event) => setReportDescription(event.target.value)} placeholder="Describe what happened…" className="mt-1.5 w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-sm font-normal text-on-surface placeholder:text-outline" />
              </label>
              <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-outline-variant bg-surface-container-low px-3 text-xs font-bold text-primary hover:bg-surface-container">
                <Icon icon="add_photo_alternate" size={18} />
                {reportPhoto ? 'Replace evidence photo' : 'Attach evidence photo (optional)'}
                <input type="file" accept="image/*" className="sr-only" onChange={(event) => void attachReportPhoto(event)} />
              </label>
              {reportPhoto && <div className="flex items-center gap-3 rounded-lg bg-surface-container-low p-2">
                <Image src={reportPhoto} alt="Evidence preview" width={80} height={56} unoptimized className="h-14 w-20 rounded-md object-cover" />
                <button type="button" onClick={() => setReportPhoto(null)} className="text-xs font-bold text-error underline">Remove photo</button>
              </div>}
              {reportError && <p role="alert" className="rounded-lg bg-error-container px-3 py-2 text-xs font-semibold text-on-error-container">{reportError}</p>}
              <div className="flex justify-end gap-2 border-t border-outline-variant pt-3">
                <button type="button" onClick={() => setReportGuard(null)} className="rounded-lg bg-surface-container px-4 py-2.5 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high">Cancel</button>
                <button type="submit" disabled={submittingReport || reportDescription.trim().length < 10} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90 disabled:opacity-50">
                  {submittingReport && <Icon icon="sync" size={17} className="animate-spin" />}
                  {submittingReport ? 'Filing…' : 'Submit report'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Lightbox Image Preview Modal */}
      {previewImage && (
        <div className="overlay-enter fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="overlay-panel relative flex w-full max-w-3xl flex-col items-center">
            <div className="w-full flex items-center justify-between text-white mb-2 px-1">
              <span className="font-bold text-sm truncate">{previewImage.title}</span>
              <button
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
    </DashboardLayout>
  );
}

function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
