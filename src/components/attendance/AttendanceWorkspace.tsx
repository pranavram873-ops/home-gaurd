'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  addRosterGuard,
  addRosterGuards,
  loadAttendancePage,
  loadBandobastForDate,
  saveDailyMark,
  type AttendanceDivision,
  type BandobastEvent,
  type DailyMark,
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

export function AttendanceWorkspace({ canAddGuards: canAddGuardsProp = false }: { canAddGuards?: boolean }) {
  const { divisionId, setDivisionId } = useDivision();
  const { role } = useAuth();
  // The workspace is shared with the admin dashboard, which keeps roster powers.
  const canAddGuards = canAddGuardsProp || role === 'admin';
  const [divisions, setDivisions] = useState<AttendanceDivision[]>([]);
  const [date, setDate] = useState(todayLocal);
  const [roster, setRoster] = useState<RosterGuard[]>([]);
  const [marks, setMarks] = useState<DailyMark[]>([]);
  const [bandobast, setBandobast] = useState<BandobastEvent[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [form, setForm] = useState({ full_name: '', phone: '', home_guard_code: '' });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    loadAttendancePage(divisionId, date)
      .then((data) => {
        if (!live) return;
        setDivisions(data.divisions);
        // The chooser screen sets the division; a direct link to attendance
        // falls back to the first division and remembers it.
        if (!divisionId) setDivisionId(data.divisions[0]?.id || '');
        setRoster(data.roster);
        setMarks(data.marks);
      })
      .catch((reason: unknown) => live && setError(reason instanceof Error ? reason.message : 'Could not load attendance.'))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [divisionId, date, setDivisionId]);

  // Bandobast only backs the panel when a real operation overlaps the duty
  // day; a failed lookup must never block the muster itself.
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
  const markedCount = presentCount + absentCount;
  const completion = roster.length ? Math.round((markedCount / roster.length) * 100) : 0;
  const selectedDivision = divisions.find((division) => division.id === divisionId);
  // `events` has no division column, so the panel binds to the operation whose
  // venue names this division; anything else would be a invented duty.
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

  return (
    <div className="mx-auto max-w-5xl space-y-3 pb-28">
      {/* Operational context: division + date pills, bandobast, completion. */}
      <section className="rounded-xl bg-surface-container-low p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="relative inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-label-md text-on-primary shadow-sm">
            <Icon icon="shield" size={16} fill className="text-secondary-container" />
            <span className="max-w-[160px] truncate">{selectedDivision?.name || 'Loading division…'}</span>
            {divisions.length > 0 && (
              <>
                <Icon icon="arrow_drop_down" size={16} className="text-on-primary-container" />
                <select
                  aria-label="Choose a division"
                  value={divisionId}
                  onChange={(event) => setDivisionId(event.target.value)}
                  className="absolute inset-0 cursor-pointer opacity-0"
                >
                  {divisions.map((division) => (
                    <option key={division.id} value={division.id}>{division.name}</option>
                  ))}
                </select>
              </>
            )}
          </span>
          <label
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-surface-container-highest px-3 py-1.5 text-label-md text-on-surface shadow-sm transition-colors hover:bg-surface-container-high"
          >
            <Icon icon="calendar_today" size={16} className="text-primary" />
            <span>{formatDay(date)}</span>
            <input
              type="date"
              value={date}
              onChange={(event) => event.target.value && setDate(event.target.value)}
              className="absolute h-0 w-0 opacity-0"
              aria-label="Muster date"
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

        <Card className="mt-3 p-3">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-label-md text-on-surface">Muster Completion</span>
              <span className="rounded bg-surface-container-high px-1.5 py-0.2 text-label-sm font-bold tabular-nums text-on-surface-variant">{completion}%</span>
            </div>
            <span className="text-label-sm text-on-surface-variant">
              <strong className="text-on-surface">{markedCount}</strong> marked · {pendingCount} left ({roster.length} total)
            </span>
          </div>
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-container shadow-inner">
            <div className="h-full bg-on-tertiary-container transition-[width] duration-300" style={{ width: `${completion ? (presentCount / roster.length) * 100 : 0}%` }} />
            <div className="h-full bg-error transition-[width] duration-300" style={{ width: `${completion ? (absentCount / roster.length) * 100 : 0}%` }} />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="flex items-center justify-between rounded-lg bg-surface-container-low p-2">
              <div className="flex items-center gap-1.5">
                <Dot className="bg-on-tertiary-container" />
                <span className="text-label-sm uppercase text-on-surface-variant">Present</span>
              </div>
              <span className="text-headline-sm tabular-nums text-on-tertiary-container">{presentCount}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-surface-container-low p-2">
              <div className="flex items-center gap-1.5">
                <Dot className="bg-error" />
                <span className="text-label-sm uppercase text-on-surface-variant">Absent</span>
              </div>
              <span className="text-headline-sm tabular-nums text-error">{absentCount}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-surface-container-low p-2">
              <div className="flex items-center gap-1.5">
                <Dot className="bg-outline" />
                <span className="text-label-sm uppercase text-on-surface-variant">Pending</span>
              </div>
              <span className="text-headline-sm tabular-nums text-on-surface">{pendingCount}</span>
            </div>
          </div>
        </Card>
      </section>

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

      {/* Roster */}
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
              return (
                <li key={guard.id} className="rounded-xl bg-surface-container-low p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-sm font-bold text-primary">
                        {initials(guard.full_name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-headline-sm text-on-surface">{guard.full_name}</p>
                        <div className="mt-0.5 flex items-center gap-2">
                          <span className="truncate text-label-sm font-bold tracking-wider text-secondary-container">{guard.home_guard_code}</span>
                          <span className="truncate text-xs text-on-surface-variant">• {guard.phone}</span>
                        </div>
                      </div>
                    </div>
                    {mark?.status === 'present' ? (
                      <Chip tone="present" icon="check_circle" className="!text-[13px]">Present</Chip>
                    ) : mark?.status === 'absent' ? (
                      <Chip tone="absent" icon="cancel" className="!text-[13px]">Absent</Chip>
                    ) : (
                      <Chip tone="pending" className="!text-[13px]">Not marked</Chip>
                    )}
                  </div>
                  <div className="mt-3 grid w-full grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={isSaving}
                      aria-pressed={mark?.status === 'present'}
                      onClick={() => void changeStatus(guard, 'present')}
                      className={`flex h-12 items-center justify-center gap-1.5 rounded-lg text-label-lg transition-all active:scale-[0.98] disabled:opacity-60 ${
                        mark?.status === 'present'
                          ? 'bg-on-tertiary-container text-on-tertiary shadow-sm'
                          : 'bg-surface-container-high text-on-surface hover:bg-on-tertiary-container hover:text-on-tertiary'
                      }`}
                    >
                      {isSaving && mark?.status !== 'present' ? <Icon icon="sync" size={20} className="animate-spin" /> : <Icon icon="check" size={20} />}
                      <span>Present</span>
                    </button>
                    <button
                      type="button"
                      disabled={isSaving}
                      aria-pressed={mark?.status === 'absent'}
                      onClick={() => void changeStatus(guard, 'absent')}
                      className={`flex h-12 items-center justify-center gap-1.5 rounded-lg text-label-lg transition-all active:scale-[0.98] disabled:opacity-60 ${
                        mark?.status === 'absent'
                          ? 'bg-error text-on-error shadow-sm'
                          : 'bg-surface-container-high text-on-surface hover:bg-error hover:text-on-error'
                      }`}
                    >
                      {isSaving && mark?.status !== 'absent' ? <Icon icon="sync" size={20} className="animate-spin" /> : <Icon icon="close" size={20} />}
                      <span>Absent</span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Sticky tally + sync bar, sitting above the bottom nav. */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 bg-surface-container-lowest/95 px-4 py-2.5 shadow-[0_-4px_12px_rgba(0,17,38,.08)] backdrop-blur-md lg:bottom-0 lg:left-[264px]">
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
                {syncing ? 'Contacting HQ Command…' : 'Syncs to HQ Command'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void syncMuster()}
            disabled={syncing || loading}
            className="flex h-12 shrink-0 items-center gap-2 rounded-xl bg-primary-container px-4 text-label-lg text-on-primary shadow-md transition-all hover:bg-primary active:scale-95 disabled:opacity-60 disabled:active:scale-100"
          >
            {syncing ? (
              <>
                <Icon icon="sync" size={20} className="animate-spin" />
                <span>Transmitting…</span>
              </>
            ) : (
              <>
                <span>Save Muster Roll</span>
                <Icon icon="arrow_forward" size={20} />
              </>
            )}
          </button>
        </div>
      </div>

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
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-label-lg text-base text-on-primary shadow-md transition-transform active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100"
          >
            {adding ? <Icon icon="sync" size={20} className="animate-spin" /> : <Icon icon="person_add" size={20} />}
            <span>{adding ? 'Adding…' : bulkMode ? 'Add pasted Home Guards' : 'Add to roster'}</span>
          </button>
        </form>
      </BottomSheet>
    </div>
  );
}
