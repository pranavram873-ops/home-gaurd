'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Check, LoaderCircle, Plus, Search, UserRound, X } from 'lucide-react';
import {
  addRosterGuard,
  addRosterGuards,
  loadAttendancePage,
  saveDailyMark,
  type AttendanceDivision,
  type DailyMark,
  type RosterGuard,
} from '@/lib/services/simpleAttendanceService';

function todayLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function AttendanceWorkspace({ canAddGuards = false }: { canAddGuards?: boolean }) {
  const [divisions, setDivisions] = useState<AttendanceDivision[]>([]);
  const [divisionId, setDivisionId] = useState('');
  const [date, setDate] = useState(todayLocal);
  const [roster, setRoster] = useState<RosterGuard[]>([]);
  const [marks, setMarks] = useState<DailyMark[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
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
        setDivisionId((current) => current || data.divisions[0]?.id || '');
        setRoster(data.roster);
        setMarks(data.marks);
      })
      .catch((reason: unknown) => live && setError(reason instanceof Error ? reason.message : 'Could not load attendance.'))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [divisionId, date]);

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
  const selectedDivision = divisions.find((division) => division.id === divisionId);

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
    <div className="mx-auto max-w-5xl space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4">
          <p className="text-sm font-semibold text-blue-800">DAILY ROLL CALL</p>
          <h2 className="mt-1 text-xl font-bold text-slate-950 sm:text-2xl">Mark attendance</h2>
          <p className="mt-1 text-sm text-slate-600">Choose a division and date, then tap Present or Absent for each Home Guard.</p>
        </div>
        <p className="mb-2 text-sm font-semibold text-slate-700">Choose a division</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {divisions.map((division) => <button key={division.id} type="button" aria-pressed={division.id === divisionId} onClick={() => setDivisionId(division.id)} className={`min-h-14 rounded-xl border px-3 py-2 text-left text-sm font-bold transition-colors ${division.id === divisionId ? 'border-blue-800 bg-blue-800 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50'}`}>
            <span className="flex items-center justify-between gap-2"><span>{division.name}</span>{division.id === divisionId && <Check className="h-4 w-4 shrink-0" />}</span>
          </button>)}
        </div>
        <div className="mt-3">
          <label className="block text-sm font-semibold text-slate-700">
            Attendance date
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1.5 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base" />
          </label>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2 sm:gap-3" aria-label="Attendance totals">
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3 sm:p-4"><p className="text-xs font-medium text-blue-800">Roster</p><p className="mt-1 text-2xl font-bold text-blue-950">{roster.length}</p></div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 sm:p-4"><p className="text-xs font-medium text-emerald-800">Present</p><p className="mt-1 text-2xl font-bold text-emerald-950">{presentCount}</p></div>
        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-3 sm:p-4"><p className="text-xs font-medium text-rose-800">Absent</p><p className="mt-1 text-2xl font-bold text-rose-950">{absentCount}</p></div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h3 className="font-bold text-slate-950">{selectedDivision?.name || 'Select a division'}</h3><p className="text-sm text-slate-500">{marks.length} of {roster.length} marked for {date}</p></div>
          <div className="flex gap-2">
            <label className="relative min-w-0 flex-1 sm:w-64 sm:flex-none"><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a Home Guard" className="h-11 w-full rounded-xl border border-slate-300 pl-9 pr-3 text-sm" /></label>
            {canAddGuards && <button type="button" onClick={() => { setError(''); setBulkMode(false); setShowAdd(true); }} className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-blue-800 px-3 text-sm font-bold text-white hover:bg-blue-900"><Plus className="h-4 w-4" /><span className="hidden sm:inline">Add / paste roster</span><span className="sm:hidden">Add</span></button>}
          </div>
        </div>
        {notice && <p role="status" className="border-b border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
        {error && <p role="alert" className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
        {loading ? <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500"><LoaderCircle className="h-5 w-5 animate-spin" />Loading attendance…</div> : roster.length === 0 ? (
          <div className="px-6 py-14 text-center"><UserRound className="mx-auto h-8 w-8 text-slate-300" /><h4 className="mt-3 font-semibold text-slate-800">No Home Guards in this division yet</h4><p className="mt-1 text-sm text-slate-500">{canAddGuards ? 'Use Add Home Guard to start building the roster.' : 'Ask an administrator to add the division roster.'}</p></div>
        ) : filteredRoster.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No Home Guards match that search.</p> : (
          <ul className="divide-y divide-slate-100">
            {filteredRoster.map((guard) => {
              const mark = markByGuard.get(guard.id);
              const isSaving = savingId === guard.id;
              return <li key={guard.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="min-w-0"><p className="truncate font-semibold text-slate-950">{guard.full_name}</p><p className="mt-0.5 text-sm text-slate-500">{guard.phone} <span className="px-1 text-slate-300">·</span> Code {guard.home_guard_code}</p></div>
                <div className="grid grid-cols-2 gap-2 sm:w-64">
                  <button type="button" disabled={isSaving} aria-pressed={mark?.status === 'present'} onClick={() => void changeStatus(guard, 'present')} className={`flex h-12 items-center justify-center gap-2 rounded-xl border text-sm font-bold transition-colors disabled:opacity-60 ${mark?.status === 'present' ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50'}`}>
                    {isSaving && mark?.status !== 'present' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Present
                  </button>
                  <button type="button" disabled={isSaving} aria-pressed={mark?.status === 'absent'} onClick={() => void changeStatus(guard, 'absent')} className={`flex h-12 items-center justify-center gap-2 rounded-xl border text-sm font-bold transition-colors disabled:opacity-60 ${mark?.status === 'absent' ? 'border-rose-700 bg-rose-700 text-white' : 'border-rose-200 bg-white text-rose-800 hover:bg-rose-50'}`}>
                    {isSaving && mark?.status !== 'absent' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}Absent
                  </button>
                </div>
              </li>;
            })}
          </ul>
        )}
      </section>

      {showAdd && canAddGuards && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4">
        <form onSubmit={(event) => void submitGuard(event)} className="w-full max-w-md space-y-4 rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl">
          <div className="flex items-center justify-between"><div><h3 className="text-lg font-bold text-slate-950">Add Home Guard</h3><p className="text-sm text-slate-500">Adding to {selectedDivision?.name}</p></div><button type="button" onClick={() => setShowAdd(false)} aria-label="Close" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
          <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1"><button type="button" onClick={() => setBulkMode(false)} className={`h-10 rounded-lg text-sm font-semibold ${!bulkMode ? 'bg-white text-blue-900 shadow-sm' : 'text-slate-600'}`}>Add one</button><button type="button" onClick={() => setBulkMode(true)} className={`h-10 rounded-lg text-sm font-semibold ${bulkMode ? 'bg-white text-blue-900 shadow-sm' : 'text-slate-600'}`}>Paste roster</button></div>
          {bulkMode ? <>
            <div className="rounded-xl bg-blue-50 p-3 text-sm text-blue-950">Copy three columns from a spreadsheet and paste below: <strong>Name · Phone · Home Guard code</strong></div>
            <textarea required rows={8} value={bulkText} onChange={(event) => setBulkText(event.target.value)} placeholder={'Name\tPhone\tHome Guard code\nRavi Kumar\t9876543210\tHG-001'} className="w-full rounded-xl border border-slate-300 p-3 font-mono text-sm" />
            <p className="text-xs text-slate-500">{bulkText.trim() ? `${bulkText.trim().split(/\r?\n/).filter(Boolean).length} rows pasted` : 'One Home Guard per line. Tab-separated columns.'}</p>
          </> : <>
          <label className="block text-sm font-semibold text-slate-700">Full name<input required autoFocus maxLength={120} value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} className="mt-1.5 h-12 w-full rounded-xl border border-slate-300 px-3 text-base" /></label>
          <label className="block text-sm font-semibold text-slate-700">Phone number<input required inputMode="numeric" pattern="[0-9]{10}" maxLength={10} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value.replace(/\D/g, '') })} className="mt-1.5 h-12 w-full rounded-xl border border-slate-300 px-3 text-base" placeholder="10 digit mobile number" /></label>
          <label className="block text-sm font-semibold text-slate-700">Home Guard code<input required maxLength={40} value={form.home_guard_code} onChange={(event) => setForm({ ...form, home_guard_code: event.target.value.toUpperCase() })} className="mt-1.5 h-12 w-full rounded-xl border border-slate-300 px-3 text-base uppercase" /></label>
          </>}
          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
          <button disabled={adding} className="h-12 w-full rounded-xl bg-blue-800 text-base font-bold text-white disabled:opacity-60">{adding ? 'Adding…' : bulkMode ? 'Add pasted Home Guards' : 'Add to roster'}</button>
        </form>
      </div>}
    </div>
  );
}
