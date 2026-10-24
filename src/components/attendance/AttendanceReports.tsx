'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, LoaderCircle } from 'lucide-react';
import { loadAttendanceReport, type AttendanceDivision } from '@/lib/services/simpleAttendanceService';

function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function AttendanceReports() {
  const today = localDate(new Date());
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  const [from, setFrom] = useState(localDate(thirtyDaysAgo));
  const [to, setTo] = useState(today);
  const [divisions, setDivisions] = useState<AttendanceDivision[]>([]);
  const [roster, setRoster] = useState<Array<{ id: string; division_id: string; full_name: string; home_guard_code: string }>>([]);
  const [marks, setMarks] = useState<Array<{ id: string; guard_id: string; division_id: string; attendance_date: string; status: 'present' | 'absent' }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    loadAttendanceReport(from, to)
      .then((data) => {
        if (!live) return;
        setDivisions(data.divisions);
        setRoster(data.roster);
        setMarks(data.marks);
      })
      .catch((reason: unknown) => live && setError(reason instanceof Error ? reason.message : 'Could not load reports.'))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [from, to]);

  const present = marks.filter((mark) => mark.status === 'present').length;
  const absent = marks.filter((mark) => mark.status === 'absent').length;
  const totalsByGuard = useMemo(() => {
    const totals = new Map<string, number>();
    for (const mark of marks) if (mark.status === 'present') totals.set(mark.guard_id, (totals.get(mark.guard_id) ?? 0) + 1);
    return totals;
  }, [marks]);

  return <div className="mx-auto max-w-5xl space-y-5">
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <p className="text-sm font-semibold text-blue-800">ATTENDANCE SUMMARY</p>
      <h2 className="mt-1 text-xl font-bold text-slate-950 sm:text-2xl">Reports</h2>
      <p className="mt-1 text-sm text-slate-600">See attendance by division and how many duties each Home Guard attended.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700">From<input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} className="mt-1.5 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base" /></label>
        <label className="text-sm font-semibold text-slate-700">To<input type="date" value={to} min={from} max={today} onChange={(event) => setTo(event.target.value)} className="mt-1.5 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base" /></label>
      </div>
    </section>

    {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
    <section className="grid grid-cols-2 gap-3">
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4"><p className="text-sm text-emerald-800">Present duty days</p><p className="mt-1 text-3xl font-bold text-emerald-950">{present}</p></div>
      <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4"><p className="text-sm text-rose-800">Absent duty days</p><p className="mt-1 text-3xl font-bold text-rose-950">{absent}</p></div>
    </section>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-200 p-4"><CalendarDays className="h-5 w-5 text-blue-800" /><h3 className="font-bold text-slate-950">Division totals</h3></div>
      {loading ? <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500"><LoaderCircle className="h-5 w-5 animate-spin" />Loading report…</div> : <div className="divide-y divide-slate-100">
        {divisions.map((division) => {
          const divisionRoster = roster.filter((guard) => guard.division_id === division.id);
          const divisionMarks = marks.filter((mark) => mark.division_id === division.id);
          return <div key={division.id} className="flex items-center justify-between gap-3 px-4 py-4">
            <div className="min-w-0"><p className="font-semibold text-slate-950">{division.name}</p><p className="text-xs text-slate-500">{divisionRoster.length} Home Guards</p></div>
            <div className="flex shrink-0 gap-3 text-right text-sm sm:gap-6"><div><p className="font-bold text-emerald-800">{divisionMarks.filter((mark) => mark.status === 'present').length}</p><p className="text-xs text-slate-500">Present</p></div><div><p className="font-bold text-rose-800">{divisionMarks.filter((mark) => mark.status === 'absent').length}</p><p className="text-xs text-slate-500">Absent</p></div></div>
          </div>;
        })}
      </div>}
    </section>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-4"><h3 className="font-bold text-slate-950">Duties attended by Home Guard</h3><p className="mt-0.5 text-sm text-slate-500">Count of days marked Present in the selected period.</p></div>
      {loading ? <div className="p-8 text-center text-sm text-slate-500">Loading…</div> : roster.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No Home Guards have been added yet.</p> : <ul className="max-h-[32rem] divide-y divide-slate-100 overflow-y-auto">
        {roster.map((guard) => <li key={guard.id} className="flex items-center justify-between gap-3 px-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{guard.full_name}</p><p className="text-xs text-slate-500">{divisions.find((division) => division.id === guard.division_id)?.name} · {guard.home_guard_code}</p></div><span className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-900">{totalsByGuard.get(guard.id) ?? 0} duties</span></li>)}
      </ul>}
    </section>
  </div>;
}
