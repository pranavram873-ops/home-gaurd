'use client';

import React, { useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useLiveQuery } from '@/lib/hooks/useLiveQuery';
import { getReportDataset, type ReportDataset } from '@/lib/services/reportService';
import type { AttendanceEvent } from '@/types';
import { ComplaintCenter } from '@/components/reports/ComplaintCenter';
import {
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  MapPin,
  TrendingUp,
  Download,
  RefreshCw,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  BarChart3,
  Plus,
  FileText,
  Loader2,
  X,
} from 'lucide-react';

// ------------------------------------------------------------------
// Types & helpers (derived from existing application data only)
// ------------------------------------------------------------------

type MusterStatus = 'present' | 'late' | 'absent' | 'pending';
type GeofenceStatus = 'verified' | 'outside' | 'none';

interface MusterRow {
  assignmentId: string;
  badge: string;
  name: string;
  unitId: string;
  unitName: string;
  duty: string;
  locationId: string;
  locationName: string;
  shift: string;
  dutyDate: string;
  scheduledAt: string; // "YYYY-MM-DD HH:mm"
  checkInAt: string | null;
  checkOutAt: string | null;
  status: MusterStatus;
  geofence: GeofenceStatus;
  distanceMeters: number | null;
  radius: number | null;
}

/**
 * `start_time` and `end_time` are Postgres `time` values, which arrive as
 * "HH:MM:SS" rather than the "0900hrs" the fixtures used. Labels drop the
 * seconds, and the scheduled timestamp must not have them appended twice.
 */
function clock(timeStr: string): string {
  if (!timeStr) return '';
  const [hh, mm] = timeStr.split(':');
  return mm ? `${hh}:${mm}` : timeStr;
}

function toDateTime(dateStr: string, timeStr: string): Date | null {
  if (!dateStr || !timeStr) return null;
  const d = new Date(`${dateStr}T${clock(timeStr)}:00`);
  return isNaN(d.getTime()) ? null : d;
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function downloadCSV(filename: string, headers: string[], rows: (string | number | null)[][]) {
  const esc = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))];
  const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const STATUS_META: Record<MusterStatus, { label: string; cls: string }> = {
  present: { label: 'Present', cls: 'bg-emerald-100 text-emerald-800' },
  late: { label: 'Late', cls: 'bg-amber-100 text-amber-800' },
  absent: { label: 'Absent / Not Reported', cls: 'bg-rose-100 text-rose-800' },
  pending: { label: 'Pending', cls: 'bg-slate-100 text-slate-600' },
};

const GEOFENCE_META: Record<GeofenceStatus, { label: string; cls: string }> = {
  verified: { label: 'Verified', cls: 'bg-emerald-100 text-emerald-800' },
  outside: { label: 'Outside Radius', cls: 'bg-rose-100 text-rose-800' },
  none: { label: 'Not Verified', cls: 'bg-slate-100 text-slate-500' },
};

// ------------------------------------------------------------------
// Small presentational components
// ------------------------------------------------------------------

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub: string;
  accent: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`text-left bg-white rounded-xl border p-4 shadow-2xs flex flex-col gap-2 transition-all ${
        active ? 'ring-2 ring-blue-800 border-blue-800' : 'border-slate-200'
      } ${onClick ? 'hover:border-blue-300 cursor-pointer' : 'cursor-default'}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent}`}>
          <Icon className="w-4 h-4" />
        </span>
      </div>
      <span className="text-2xl font-extrabold text-slate-900 leading-none">{value}</span>
      <span className="text-[11px] text-slate-500">{sub}</span>
    </button>
  );
}

function Badge({ text, cls }: { text: string; cls: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${cls}`}>{text}</span>;
}

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-28 shrink-0 text-slate-600 truncate" title={label}>{label}</span>
      <div className="flex-1 h-5 bg-slate-100 rounded overflow-hidden">
        <div className={`h-full ${color} flex items-center justify-end pr-1.5`} style={{ width: `${Math.max(pct, value > 0 ? 8 : 0)}%` }}>
          <span className="text-[10px] font-bold text-white">{value}</span>
        </div>
      </div>
    </div>
  );
}

function Donut({ segments, centerLabel, centerValue }: {
  segments: { value: number; color: string; label?: string }[];
  centerLabel: string;
  centerValue: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  let acc = 0;
  const stops = segments.map((s) => {
    const start = total > 0 ? (acc / total) * 360 : 0;
    acc += s.value;
    const end = total > 0 ? (acc / total) * 360 : 0;
    return `${s.color} ${start}deg ${end}deg`;
  });
  const bg = total > 0 ? `conic-gradient(${stops.join(', ')})` : '#e2e8f0';
  return (
    <div className="flex items-center gap-4">
      <div className="relative w-24 h-24 rounded-full shrink-0" style={{ background: bg }}>
        <div className="absolute inset-2.5 bg-white rounded-full flex flex-col items-center justify-center">
          <span className="text-lg font-extrabold text-slate-900 leading-none">{centerValue}</span>
          <span className="text-[9px] text-slate-500 uppercase font-bold mt-0.5">{centerLabel}</span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
            <span className="font-semibold text-slate-800">{s.value}</span>
            <span className="text-slate-500">{s.label ?? ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Main page
// ------------------------------------------------------------------

export default function ReportsPage() {
  const reportQuery = useLiveQuery<ReportDataset>(() => getReportDataset(), null);

  // Every figure on this page is computed from these six arrays, read once in a
  // single parallel round trip. The arithmetic beneath them is unchanged from
  // when it ran against the in-memory fixtures; only the source moved. The
  // empties are stable references, so the memos beneath recompute only when a
  // refresh actually lands new rows rather than on every render.
  const dataset = reportQuery.data;
  const { assignments, attendance, tasks, units, locations, guards } = useMemo(
    () => ({
      assignments: dataset?.assignments ?? [],
      attendance: dataset?.attendance ?? [],
      tasks: dataset?.tasks ?? [],
      units: dataset?.units ?? [],
      locations: dataset?.locations ?? [],
      guards: dataset?.guards ?? [],
    }),
    [dataset],
  );

  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d' | 'all'>('all');
  const [unitFilter, setUnitFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [shiftFilter, setShiftFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | MusterStatus>('all');
  const [search, setSearch] = useState('');
  const [expandedUnit, setExpandedUnit] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [reportTitle, setReportTitle] = useState<string | null>(null);
  const [showNewReport, setShowNewReport] = useState(false);
  const [reportForm, setReportForm] = useState<{
    title: string;
    type: 'muster' | 'unit' | 'geofence' | 'task';
    range: 'today' | '7d' | '30d' | 'all';
    subjectId: string;
    showActive: boolean;
  }>({ title: '', type: 'muster', range: '30d', subjectId: '', showActive: true });

  // Build the muster rows by joining duty assignments with attendance events.
  const allRows = useMemo<MusterRow[]>(() => {
    const checkInByAsg = new Map<string, AttendanceEvent>();
    const checkOutByAsg = new Map<string, AttendanceEvent>();
    for (const e of attendance) {
      if (!e.duty_assignment_id) continue;
      if (e.event_type === 'check_in') checkInByAsg.set(e.duty_assignment_id, e);
      else checkOutByAsg.set(e.duty_assignment_id, e);
    }

    return assignments.map((a) => {
      const checkIn = checkInByAsg.get(a.id) || null;
      const checkOut = checkOutByAsg.get(a.id) || null;
      const scheduled = toDateTime(a.duty_date, a.start_time);

      let status: MusterStatus;
      if (a.status === 'cancelled') status = 'pending';
      else if (!checkIn) status = 'absent';
      else if (scheduled && new Date(checkIn.recorded_at).getTime() > scheduled.getTime()) status = 'late';
      else status = 'present';

      const geofence: GeofenceStatus = !checkIn ? 'none' : checkIn.is_within_geofence ? 'verified' : 'outside';

      return {
        assignmentId: a.id,
        badge: a.personnel?.personnel_id || '—',
        name: a.personnel?.full_name || 'Assigned Volunteer',
        unitId: a.personnel?.unit_id || a.unit_id || 'unassigned',
        unitName: a.personnel?.unit?.name || a.unit?.name || 'Unassigned Unit',
        duty: a.title,
        locationId: a.duty_location_id || '',
        locationName: a.location?.name || 'Assigned Post',
        shift: `${clock(a.start_time)} – ${clock(a.end_time)}`,
        dutyDate: a.duty_date,
        scheduledAt: scheduled ? `${a.duty_date} ${clock(a.start_time)}` : a.duty_date,
        checkInAt: checkIn?.recorded_at || null,
        checkOutAt: checkOut?.recorded_at || null,
        status,
        geofence,
        // The distance is stored with sub-metre precision; a muster roll reads
        // it in whole metres.
        distanceMeters: checkIn ? Math.round(checkIn.distance_meters) : null,
        radius: a.location?.radius_meters ?? null,
      };
    });
  }, [assignments, attendance]);

  // Cutoff for date-range filtering (based on duty_date).
  const minDate = useMemo(() => {
    const now = new Date();
    if (dateRange === 'today') return now.toISOString().split('T')[0];
    if (dateRange === '7d') return new Date(now.getTime() - 6 * 86400000).toISOString().split('T')[0];
    if (dateRange === '30d') return new Date(now.getTime() - 29 * 86400000).toISOString().split('T')[0];
    return null;
  }, [dateRange]);

  const shiftOptions = useMemo(() => Array.from(new Set(allRows.map((r) => r.shift))), [allRows]);

  // Rows after date + unit + location + shift (used for cards & charts).
  const baseRows = useMemo(
    () =>
      allRows.filter(
        (r) =>
          (!minDate || r.dutyDate >= minDate) &&
          (unitFilter === 'all' || r.unitId === unitFilter) &&
          (locationFilter === 'all' || r.locationId === locationFilter) &&
          (shiftFilter === 'all' || r.shift === shiftFilter),
      ),
    [allRows, minDate, unitFilter, locationFilter, shiftFilter],
  );

  // Rows additionally narrowed by status + search (used for the table).
  const tableRows = useMemo(
    () =>
      baseRows.filter((r) => {
        if (statusFilter !== 'all' && r.status !== statusFilter) return false;
        if (search) {
          const q = search.toLowerCase();
          return r.name.toLowerCase().includes(q) || r.badge.toLowerCase().includes(q);
        }
        return true;
      }),
    [baseRows, statusFilter, search],
  );

  // Summary stats derived from baseRows.
  const stats = useMemo(() => {
    const present = baseRows.filter((r) => r.status === 'present').length;
    const late = baseRows.filter((r) => r.status === 'late').length;
    const absent = baseRows.filter((r) => r.status === 'absent').length;
    const pending = baseRows.filter((r) => r.status === 'pending').length;
    const checkedIn = baseRows.filter((r) => r.checkInAt).length;
    const verified = baseRows.filter((r) => r.geofence === 'verified').length;
    const geofencePct = checkedIn > 0 ? Math.round((verified / checkedIn) * 100) : 0;
    return { total: baseRows.length, present, late, absent, pending, checkedIn, verified, geofencePct };
  }, [baseRows]);

  // Task stats (filtered by unit where applicable).
  const taskStats = useMemo(() => {
    const scoped = unitFilter === 'all' ? tasks : tasks.filter((t) => t.unit_id === unitFilter);
    const now = Date.now();
    const completed = scoped.filter((t) => t.status === 'completed').length;
    const inProgress = scoped.filter((t) => t.status === 'in_progress').length;
    const pending = scoped.filter((t) => t.status === 'new' || t.status === 'assigned').length;
    const overdue = scoped.filter(
      (t) => t.due_date && new Date(t.due_date).getTime() < now && t.status !== 'completed' && t.status !== 'cancelled',
    ).length;
    const pct = scoped.length > 0 ? Math.round((completed / scoped.length) * 100) : 0;
    return { total: scoped.length, completed, inProgress, pending, overdue, pct };
  }, [tasks, unitFilter]);

  // Unit deployment overview from baseRows.
  const unitGroups = useMemo(() => {
    const map = new Map<string, { name: string; rows: MusterRow[] }>();
    for (const r of baseRows) {
      if (!map.has(r.unitId)) map.set(r.unitId, { name: r.unitName, rows: [] });
      map.get(r.unitId)!.rows.push(r);
    }
    return Array.from(map.entries()).map(([id, g]) => ({
      id,
      name: g.name,
      total: g.rows.length,
      present: g.rows.filter((r) => r.status === 'present' || r.status === 'late').length,
      notReported: g.rows.filter((r) => r.status === 'absent').length,
      dutyLocations: Array.from(new Set(g.rows.map((r) => r.locationName))),
      rows: g.rows,
    }));
  }, [baseRows]);

  // Geofence exception list (check-ins recorded outside the permitted radius).
  const geofenceExceptions = useMemo(
    () => baseRows.filter((r) => r.geofence === 'outside'),
    [baseRows],
  );

  // Attendance trend per day within the selected range.
  const trend = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of baseRows) {
      if (!r.checkInAt) continue;
      const day = r.dutyDate;
      map.set(day, (map.get(day) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(-7);
  }, [baseRows]);

  const maxTrend = trend.reduce((m, [, v]) => Math.max(m, v), 0);

  // ---------------- Exports ----------------
  const exportMuster = () =>
    downloadCSV(
      `TNHG_Muster_${new Date().toISOString().split('T')[0]}.csv`,
      ['Badge ID', 'Name', 'Unit', 'Assigned Duty', 'Location', 'Shift', 'Scheduled Reporting', 'Check-In', 'Check-Out', 'Attendance Status', 'Geofence'],
      tableRows.map((r) => [
        r.badge, r.name, r.unitName, r.duty, r.locationName, r.shift, r.scheduledAt,
        fmtDateTime(r.checkInAt), fmtDateTime(r.checkOutAt), STATUS_META[r.status].label, GEOFENCE_META[r.geofence].label,
      ]),
    );

  const exportUnitDeployment = () =>
    downloadCSV(
      `TNHG_Unit_Deployment_${new Date().toISOString().split('T')[0]}.csv`,
      ['Unit', 'Total Assigned', 'Reported', 'Yet To Report', 'Duty Locations'],
      unitGroups.map((u) => [u.name, u.total, u.present, u.notReported, u.dutyLocations.join(' | ')]),
    );

  const exportGeofence = () =>
    downloadCSV(
      `TNHG_Geofence_Compliance_${new Date().toISOString().split('T')[0]}.csv`,
      ['Badge ID', 'Name', 'Location', 'Permitted Radius (m)', 'Recorded Distance (m)', 'Verification'],
      baseRows
        .filter((r) => r.checkInAt)
        .map((r) => [r.badge, r.name, r.locationName, r.radius ?? '', r.distanceMeters ?? '', GEOFENCE_META[r.geofence].label]),
    );

  const exportTasks = () =>
    downloadCSV(
      `TNHG_Task_Completion_${new Date().toISOString().split('T')[0]}.csv`,
      ['Task', 'Assignee', 'Unit', 'Status', 'Priority', 'Due Date'],
      (unitFilter === 'all' ? tasks : tasks.filter((t) => t.unit_id === unitFilter)).map((t) => [
        t.title, t.assignee?.full_name || '—', t.unit?.name || '—', t.status.replace('_', ' '),
        t.priority, t.due_date ? new Date(t.due_date).toLocaleDateString('en-IN') : '—',
      ]),
    );

  const resetFilters = () => {
    setDateRange('all');
    setUnitFilter('all');
    setLocationFilter('all');
    setShiftFilter('all');
    setStatusFilter('all');
    setSearch('');
  };

  const exportByType = (type: typeof reportForm.type) => {
    if (type === 'unit') exportUnitDeployment();
    else if (type === 'geofence') exportGeofence();
    else if (type === 'task') exportTasks();
    else exportMuster();
  };

  const createReport = (andExport: boolean) => {
    const subject = guards.find((g) => g.id === reportForm.subjectId) || null;
    const typeLabel = reportForm.type.charAt(0).toUpperCase() + reportForm.type.slice(1);
    const title = reportForm.title.trim() || `${typeLabel} Report${subject ? ` – ${subject.full_name}` : ''}`;
    setDateRange(reportForm.range);
    if (subject?.unit_id) setUnitFilter(subject.unit_id);
    setReportTitle(title);
    setGeneratedAt(new Date().toISOString());
    setShowNewReport(false);
    if (andExport) exportByType(reportForm.type);
  };

  // Derived lookups for the "active in the spot" readout inside the New Report modal.
  const reportSubject = guards.find((g) => g.id === reportForm.subjectId) || null;
  const subjectDivision = reportSubject?.unit?.name || '—';
  const divisionRows = reportSubject ? allRows.filter((r) => r.unitId === reportSubject.unit_id) : [];
  const activeInSpot = divisionRows.filter((r) => r.status === 'present' || r.status === 'late').length;

  const filterActive =
    dateRange !== 'all' || unitFilter !== 'all' || locationFilter !== 'all' || shiftFilter !== 'all' || statusFilter !== 'all' || search !== '';

  const selectCls =
    'px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-800';

  return (
    <DashboardLayout title="Reports & Analytics" subtitle="Duty Performance, Attendance & Operational Compliance">
      <div className="max-w-7xl mx-auto flex flex-col gap-5">
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3">
            <h2 className="text-base font-bold text-slate-900">Personnel reports & complaints</h2>
            <p className="mt-1 text-xs text-slate-600">Review reports filed by Home Guards or administrators, update their status, and share the outcome.</p>
          </div>
          <ComplaintCenter />
        </section>

        {reportQuery.error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">The reporting data could not be read</span>
              <p className="mt-0.5">{reportQuery.error}</p>
            </div>
          </div>
        )}

        {reportQuery.loading && (
          <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Reading duty, muster and task rows from the database…
          </p>
        )}
        {/* Header / action bar */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 flex flex-col lg:flex-row lg:items-end gap-3">
          <div className="flex flex-wrap items-end gap-3 flex-1">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Date Range</label>
              <select value={dateRange} onChange={(e) => setDateRange(e.target.value as typeof dateRange)} className={selectCls}>
                <option value="today">Today</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="all">All Time</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Unit</label>
              <select value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)} className={selectCls}>
                <option value="all">All Units</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Duty Location</label>
              <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} className={selectCls}>
                <option value="all">All Locations</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Shift</label>
              <select value={shiftFilter} onChange={(e) => setShiftFilter(e.target.value)} className={selectCls}>
                <option value="all">All Shifts</option>
                {shiftOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Attendance Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className={selectCls}>
                <option value="all">All Statuses</option>
                <option value="present">Present</option>
                <option value="late">Late</option>
                <option value="absent">Absent / Not Reported</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            {filterActive && (
              <button onClick={resetFilters} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer">
                <X className="w-3.5 h-3.5" /> Clear
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNewReport(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" /> New Report
            </button>
            <button
              onClick={() => {
                void reportQuery.refresh();
                setGeneratedAt(new Date().toISOString());
              }}
              disabled={reportQuery.loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${reportQuery.loading ? 'animate-spin' : ''}`} /> Generate Report
            </button>
            <button
              onClick={exportMuster}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-800 hover:bg-blue-900 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" /> Export Report
            </button>
          </div>
        </div>
        {generatedAt && (
          <p className="text-[11px] text-slate-500 -mt-2">
            {reportTitle ? <span className="font-bold text-slate-700">{reportTitle}</span> : 'Report'} generated on {new Date(generatedAt).toLocaleString('en-IN')} • reflects {baseRows.length} deployment record(s) for the selected filters.
          </p>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <StatCard icon={Users} label="Deployed" value={stats.total} sub="Guards assigned to duty" accent="bg-blue-100 text-blue-800" />
          <StatCard icon={CheckCircle2} label="Present" value={stats.present} sub="Checked in on time" accent="bg-emerald-100 text-emerald-700" active={statusFilter === 'present'} onClick={() => setStatusFilter(statusFilter === 'present' ? 'all' : 'present')} />
          <StatCard icon={AlertCircle} label="Not Reported" value={stats.absent} sub="No valid check-in" accent="bg-rose-100 text-rose-700" active={statusFilter === 'absent'} onClick={() => setStatusFilter(statusFilter === 'absent' ? 'all' : 'absent')} />
          <StatCard icon={Clock} label="Late Reporting" value={stats.late} sub="After scheduled time" accent="bg-amber-100 text-amber-700" active={statusFilter === 'late'} onClick={() => setStatusFilter(statusFilter === 'late' ? 'all' : 'late')} />
          <StatCard icon={MapPin} label="Geofence" value={`${stats.geofencePct}%`} sub={`${stats.verified}/${stats.checkedIn} in radius`} accent="bg-indigo-100 text-indigo-700" />
          <StatCard icon={TrendingUp} label="Task Completion" value={`${taskStats.pct}%`} sub={`${taskStats.completed}/${taskStats.total} tasks done`} accent="bg-teal-100 text-teal-700" />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-blue-800" /> Attendance Distribution</h3>
            {stats.total === 0 ? (
              <EmptyHint />
            ) : (
              <Donut
                centerValue={`${stats.total}`}
                centerLabel="On Roster"
                segments={[
                  { value: stats.present, color: '#047857', label: 'Present' },
                  { value: stats.late, color: '#d97706', label: 'Late' },
                  { value: stats.absent, color: '#e11d48', label: 'Absent' },
                  { value: stats.pending, color: '#94a3b8', label: 'Pending' },
                ]}
              />
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-blue-800" /> Unit-wise Deployment</h3>
            {unitGroups.length === 0 ? (
              <EmptyHint />
            ) : (
              <div className="flex flex-col gap-2">
                {unitGroups.map((u) => (
                  <BarRow key={u.id} label={u.name} value={u.total} max={Math.max(...unitGroups.map((x) => x.total))} color="bg-blue-800" />
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-blue-800" /> Task Completion</h3>
            {taskStats.total === 0 ? (
              <EmptyHint />
            ) : (
              <div className="flex flex-col gap-2">
                <BarRow label="Completed" value={taskStats.completed} max={taskStats.total} color="bg-emerald-600" />
                <BarRow label="In Progress" value={taskStats.inProgress} max={taskStats.total} color="bg-blue-700" />
                <BarRow label="Pending" value={taskStats.pending} max={taskStats.total} color="bg-amber-500" />
                <BarRow label="Overdue" value={taskStats.overdue} max={taskStats.total} color="bg-rose-600" />
              </div>
            )}
          </div>
        </div>

        {/* Attendance trend */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4">
          <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-blue-800" /> Check-in Trend (selected range)</h3>
          {trend.length === 0 ? (
            <EmptyHint />
          ) : (
            <div className="flex items-end gap-4 h-28 overflow-x-auto">
              {trend.map(([day, v]) => (
                <div key={day} className="flex flex-col items-center gap-1 shrink-0">
                  <span className="text-[10px] font-bold text-slate-600">{v}</span>
                  <div className="w-8 bg-blue-800 rounded-t" style={{ height: `${maxTrend > 0 ? (v / maxTrend) * 80 : 0}px`, minHeight: v > 0 ? 6 : 0 }} />
                  <span className="text-[10px] text-slate-500">{new Date(day).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Muster table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Attendance & Muster Report</h3>
              <p className="text-[11px] text-slate-500">Showing {tableRows.length} of {baseRows.length} deployment record(s)</p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or badge ID..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-800"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-blue-900 text-white font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Badge ID</th>
                  <th className="py-2.5 px-3">Home Guard</th>
                  <th className="py-2.5 px-3">Unit</th>
                  <th className="py-2.5 px-3">Assigned Duty</th>
                  <th className="py-2.5 px-3">Location</th>
                  <th className="py-2.5 px-3">Shift</th>
                  <th className="py-2.5 px-3">Scheduled</th>
                  <th className="py-2.5 px-3">Check-in</th>
                  <th className="py-2.5 px-3">Check-out</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Geofence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tableRows.map((r) => (
                  <tr key={r.assignmentId} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-900">{r.badge}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{r.name}</td>
                    <td className="py-2.5 px-3 text-slate-600">{r.unitName}</td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-[180px] truncate" title={r.duty}>{r.duty}</td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-[160px] truncate" title={r.locationName}>{r.locationName}</td>
                    <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{r.shift}</td>
                    <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{r.scheduledAt}</td>
                    <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{fmtDateTime(r.checkInAt)}</td>
                    <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{fmtDateTime(r.checkOutAt)}</td>
                    <td className="py-2.5 px-3"><Badge text={STATUS_META[r.status].label} cls={STATUS_META[r.status].cls} /></td>
                    <td className="py-2.5 px-3"><Badge text={GEOFENCE_META[r.geofence].label} cls={GEOFENCE_META[r.geofence].cls} /></td>
                  </tr>
                ))}
                {tableRows.length === 0 && (
                  <tr>
                    <td colSpan={11}><EmptyTable filterActive={filterActive} /></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Unit deployment overview */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Unit Deployment Overview</h3>
            <button onClick={exportUnitDeployment} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs cursor-pointer">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {unitGroups.length === 0 && <div className="p-6"><EmptyTable filterActive={filterActive} /></div>}
            {unitGroups.map((u) => {
              const open = expandedUnit === u.id;
              return (
                <div key={u.id}>
                  <button
                    onClick={() => setExpandedUnit(open ? null : u.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 cursor-pointer"
                  >
                    {open ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <span className="font-bold text-sm text-slate-900 block truncate">{u.name}</span>
                      <span className="text-[11px] text-slate-500">{u.dutyLocations.length} duty location(s)</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <Metric label="Assigned" value={u.total} cls="text-blue-900" />
                      <Metric label="Reported" value={u.present} cls="text-emerald-700" />
                      <Metric label="Yet to Report" value={u.notReported} cls="text-rose-700" />
                      <Badge text={u.notReported === 0 ? 'Fully Deployed' : 'Attention'} cls={u.notReported === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'} />
                    </div>
                  </button>
                  {open && (
                    <div className="bg-slate-50 px-4 py-2">
                      <table className="w-full text-left text-xs">
                        <tbody className="divide-y divide-slate-200">
                          {u.rows.map((r) => (
                            <tr key={r.assignmentId}>
                              <td className="py-1.5 pr-3 font-mono text-blue-900">{r.badge}</td>
                              <td className="py-1.5 pr-3 font-semibold text-slate-800">{r.name}</td>
                              <td className="py-1.5 pr-3 text-slate-600">{r.locationName}</td>
                              <td className="py-1.5 pr-3 text-slate-500">{r.shift}</td>
                              <td className="py-1.5"><Badge text={STATUS_META[r.status].label} cls={STATUS_META[r.status].cls} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Location compliance */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Location Compliance</h3>
              <p className="text-[11px] text-slate-500">Geofence verification results from recorded attendance events.</p>
            </div>
            <button onClick={exportGeofence} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs cursor-pointer">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 border-b border-slate-100">
            <SummaryPill label="Verified In Radius" value={stats.verified} cls="text-emerald-700 bg-emerald-50" />
            <SummaryPill label="Outside Radius" value={geofenceExceptions.length} cls="text-rose-700 bg-rose-50" />
            <SummaryPill label="Missing Verification" value={baseRows.filter((r) => r.geofence === 'none').length} cls="text-slate-600 bg-slate-100" />
            <SummaryPill label="Compliance" value={`${stats.geofencePct}%`} cls="text-blue-800 bg-blue-50" />
          </div>
          {geofenceExceptions.length === 0 ? (
            <div className="p-4 text-xs text-slate-500 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> No location exceptions for the selected filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px]">
                    <th className="py-2 px-4">Badge ID</th>
                    <th className="py-2 px-4">Home Guard</th>
                    <th className="py-2 px-4">Duty Location</th>
                    <th className="py-2 px-4">Permitted Radius</th>
                    <th className="py-2 px-4">Recorded Distance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {geofenceExceptions.map((r) => (
                    <tr key={r.assignmentId} className="hover:bg-slate-50">
                      <td className="py-2 px-4 font-mono font-bold text-blue-900">{r.badge}</td>
                      <td className="py-2 px-4 font-semibold text-slate-800">{r.name}</td>
                      <td className="py-2 px-4 text-slate-600">{r.locationName}</td>
                      <td className="py-2 px-4 text-slate-600">{r.radius != null ? `${r.radius} m` : '—'}</td>
                      <td className="py-2 px-4 font-bold text-rose-700">{r.distanceMeters != null ? `${r.distanceMeters} m` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Duty & task performance */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Duty & Task Performance</h3>
            <button onClick={exportTasks} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs cursor-pointer">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4">
            <SummaryPill label="Total Tasks" value={taskStats.total} cls="text-slate-800 bg-slate-100" />
            <SummaryPill label="Completed" value={taskStats.completed} cls="text-emerald-700 bg-emerald-50" />
            <SummaryPill label="In Progress" value={taskStats.inProgress} cls="text-blue-800 bg-blue-50" />
            <SummaryPill label="Pending" value={taskStats.pending} cls="text-amber-700 bg-amber-50" />
            <SummaryPill label="Overdue" value={taskStats.overdue} cls="text-rose-700 bg-rose-50" />
          </div>
          <div className="px-4 pb-4">
            <p className="text-[11px] text-slate-500 mb-2">Task completion by unit</p>
            {unitGroups.length === 0 ? (
              <EmptyHint />
            ) : (
              <div className="flex flex-col gap-2">
                {unitGroups.map((u) => {
                  const scopedTasks = tasks.filter((t) => (t.unit_id || 'unassigned') === u.id);
                  const done = scopedTasks.filter((t) => t.status === 'completed').length;
                  return <BarRow key={u.id} label={u.name} value={done} max={Math.max(scopedTasks.length, 1)} color="bg-emerald-600" />;
                })}
              </div>
            )}
          </div>
        </div>

        {/* New Report Modal */}
        {showNewReport && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
              <div className="p-4 bg-blue-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-200" />
                  <h3 className="font-bold text-sm">Compose New Report</h3>
                </div>
                <button onClick={() => setShowNewReport(false)} className="text-white hover:text-slate-300 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 flex flex-col gap-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Report Title</label>
                  <input
                    type="text"
                    value={reportForm.title}
                    onChange={(e) => setReportForm({ ...reportForm, title: e.target.value })}
                    placeholder="e.g. Weekly Muster Compliance – Last 30 Days"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Report Type</label>
                    <select
                      value={reportForm.type}
                      onChange={(e) => setReportForm({ ...reportForm, type: e.target.value as typeof reportForm.type })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white"
                    >
                      <option value="muster">Attendance / Muster</option>
                      <option value="unit">Unit Deployment</option>
                      <option value="geofence">Geofence Compliance</option>
                      <option value="task">Task Completion</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Date Range</label>
                    <select
                      value={reportForm.range}
                      onChange={(e) => setReportForm({ ...reportForm, range: e.target.value as typeof reportForm.range })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white"
                    >
                      <option value="today">Today</option>
                      <option value="7d">Last 7 Days</option>
                      <option value="30d">Last 30 Days</option>
                      <option value="all">All Time</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Reporting On (Home Guard)</label>
                    <select
                      value={reportForm.subjectId}
                      onChange={(e) => setReportForm({ ...reportForm, subjectId: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white"
                    >
                      <option value="">Select personnel…</option>
                      {guards.map((g) => (
                        <option key={g.id} value={g.id}>{g.full_name} ({g.personnel_id})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Division</label>
                    <input
                      type="text"
                      readOnly
                      value={subjectDivision}
                      placeholder="Auto-filled from selected personnel"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-700"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={reportForm.showActive}
                    onChange={(e) => setReportForm({ ...reportForm, showActive: e.target.checked })}
                    className="w-4 h-4 accent-blue-800"
                  />
                  Show how many are active in the spot
                </label>

                {reportForm.showActive && (
                  <div className="text-[11px] rounded-lg p-2.5 flex items-center gap-2 bg-blue-50 text-blue-900">
                    <Users className="w-4 h-4 shrink-0" />
                    {reportSubject ? (
                      <span>
                        <strong>{activeInSpot}</strong> of <strong>{divisionRows.length}</strong> personnel in{' '}
                        <strong>{subjectDivision}</strong> are currently active (checked in) at their duty spot.
                      </span>
                    ) : (
                      <span>Select a personnel to view their division&rsquo;s live active count at the spot.</span>
                    )}
                  </div>
                )}

                <p className="text-[11px] text-slate-500 bg-slate-50 rounded-lg p-2.5">
                  The report is generated from the rows currently held in the database (duty assignments, attendance and tasks) for the selected date range. Any unit/location/shift filters still applied on the page will be respected on export.
                </p>

                <div className="pt-2 border-t border-slate-100 flex justify-end gap-2">
                  <button
                    onClick={() => setShowNewReport(false)}
                    className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => createReport(false)}
                    className="px-4 py-2 rounded-lg bg-slate-200 text-slate-800 font-bold hover:bg-slate-300 cursor-pointer"
                  >
                    Generate
                  </button>
                  <button
                    onClick={() => createReport(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-800 text-white font-bold hover:bg-blue-900 cursor-pointer"
                  >
                    <Download className="w-4 h-4" /> Create &amp; Export
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

// ------------------------------------------------------------------
// Inline helpers
// ------------------------------------------------------------------

function Metric({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className="flex flex-col items-end">
      <span className={`font-extrabold text-sm leading-none ${cls}`}>{value}</span>
      <span className="text-[9px] text-slate-400 uppercase font-bold mt-0.5">{label}</span>
    </div>
  );
}

function SummaryPill({ label, value, cls }: { label: string; value: number | string; cls: string }) {
  return (
    <div className={`rounded-lg px-3 py-2.5 flex flex-col ${cls.split(' ')[1]}`}>
      <span className={`text-xl font-extrabold leading-none ${cls.split(' ')[0]}`}>{value}</span>
      <span className="text-[10px] font-bold uppercase tracking-wider opacity-70 mt-1">{label}</span>
    </div>
  );
}

function EmptyHint() {
  return <p className="text-xs text-slate-400 py-4 text-center">No data available for the selected filters.</p>;
}

/**
 * An empty muster roll means two different things: the filters hid rows that
 * exist, or no duty has been deployed yet. Only the second is answered by
 * changing a filter, so the page has to say which one it is showing.
 */
function EmptyTable({ filterActive }: { filterActive?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <Filter className="w-6 h-6 text-slate-300" />
      {filterActive ? (
        <>
          <p className="text-sm font-semibold text-slate-500">No records match the current filters</p>
          <p className="text-xs text-slate-400">Adjust the date range, unit, location or shift filters above.</p>
        </>
      ) : (
        <>
          <p className="text-sm font-semibold text-slate-500">No deployment records on the system yet</p>
          <p className="text-xs text-slate-400 max-w-md">
            This roll is built from duty assignments and the check-ins recorded against them. Deploy a bandobast and
            stamp a muster, and the rows appear here.
          </p>
        </>
      )}
    </div>
  );
}
