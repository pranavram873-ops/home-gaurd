'use client';

import React from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useLiveQuery } from '@/lib/hooks/useLiveQuery';
import { getAdminStats, type AdminStats } from '@/lib/services/statsService';
import { listPersonnel } from '@/lib/services/personnelService';
import { useAuth } from '@/lib/auth/authContext';
import type { Profile } from '@/types';
import {
  Users,
  CalendarCheck,
  CalendarDays,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  ClipboardList,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
} from 'lucide-react';

/** A count is unknown until the query lands, and an unknown is not a zero. */
function value(count: number | undefined): string {
  return count === undefined ? '—' : String(count);
}

export default function AdminDashboardPage() {
  const { user } = useAuth();

  // Twelve head-count queries plus two small ordered selects, all under the
  // administrator policies. Nothing here is cached in state, because a command
  // overview that is quietly stale is worse than one that is obviously loading.
  const statsQuery = useLiveQuery<AdminStats | null>(() => getAdminStats(), null);
  const pendingQuery = useLiveQuery<Profile[]>(() => listPersonnel({ status: 'pending' }), null);

  const stats = statsQuery.data;
  const recentAttendance = stats?.recentAttendance ?? [];
  const recentAuditLogs = stats?.recentAuditLogs ?? [];
  const pendingApprovalsList = pendingQuery.data ?? [];

  const refreshAll = () => {
    void statsQuery.refresh();
    void pendingQuery.refresh();
  };

  return (
    <DashboardLayout
      title="Headquarters Command Overview"
      subtitle="Tamil Nadu Home Guards & Civil Defence Directorate"
    >
      <div className="flex flex-col gap-6 max-w-7xl mx-auto">
        {/* Welcome Command Banner */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-blue-800 text-white tracking-wider">
                State Headquarters
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-xs font-semibold text-slate-600">Directorate of Home Guards & Civil Defence</span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Good day, {user?.full_name || 'Commandant'}
            </h2>
            <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
              Operational oversight across every district unit on this system. Figures are read live from the
              duty roster, muster register and task board.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={refreshAll}
              disabled={statsQuery.loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${statsQuery.loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {statsQuery.error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">The command overview could not be loaded</span>
              <p className="mt-0.5">{statsQuery.error}</p>
            </div>
          </div>
        )}

        {/* Quick Action Palette */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link
            href="/admin/personnel?action=new"
            className="flex items-center justify-between p-3.5 bg-white hover:bg-blue-50/60 border border-slate-200 hover:border-blue-300 rounded-xl shadow-2xs transition-all group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-900 flex items-center justify-center shrink-0 group-hover:bg-blue-800 group-hover:text-white transition-all">
                <Users className="w-5 h-5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-slate-900 truncate">Enrol Personnel</span>
                <span className="text-[11px] text-slate-500 truncate">Create or update profile</span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-800 group-hover:translate-x-0.5 transition-all" />
          </Link>

          <Link
            href="/admin/assignments"
            className="flex items-center justify-between p-3.5 bg-white hover:bg-blue-50/60 border border-slate-200 hover:border-blue-300 rounded-xl shadow-2xs transition-all group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-900 flex items-center justify-center shrink-0 group-hover:bg-indigo-800 group-hover:text-white transition-all">
                <CalendarCheck className="w-5 h-5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-slate-900 truncate">Deploy Bandobast</span>
                <span className="text-[11px] text-slate-500 truncate">Schedule duty rosters</span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-800 group-hover:translate-x-0.5 transition-all" />
          </Link>

          <Link
            href="/admin/events"
            className="flex items-center justify-between p-3.5 bg-white hover:bg-emerald-50/60 border border-slate-200 hover:border-emerald-300 rounded-xl shadow-2xs transition-all group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-900 flex items-center justify-center shrink-0 group-hover:bg-emerald-800 group-hover:text-white transition-all">
                <CalendarDays className="w-5 h-5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-slate-900 truncate">Plan Event</span>
                <span className="text-[11px] text-slate-500 truncate">VIP route & drills</span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-800 group-hover:translate-x-0.5 transition-all" />
          </Link>

          <Link
            href="/admin/reports"
            className="flex items-center justify-between p-3.5 bg-white hover:bg-amber-50/60 border border-slate-200 hover:border-amber-300 rounded-xl shadow-2xs transition-all group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-900 flex items-center justify-center shrink-0 group-hover:bg-amber-800 group-hover:text-white transition-all">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-slate-900 truncate">Muster Reports</span>
                <span className="text-[11px] text-slate-500 truncate">Export attendance CSV</span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-800 group-hover:translate-x-0.5 transition-all" />
          </Link>
        </div>

        {/* 6-Grid Operational Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Enrolled</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-slate-900">{value(stats?.totalRegisteredGuards)}</span>
              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold">State Cadre</span>
            </div>
            <span className="text-[11px] text-slate-400 mt-2">Active: {value(stats?.activeGuards)}</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Currently On Duty</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-blue-900">{value(stats?.onDutyCount)}</span>
              <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-bold">Live</span>
            </div>
            <span className="text-[11px] text-slate-400 mt-2">Scheduled: {value(stats?.scheduledCount)}</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pending Approvals</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-amber-700">{value(stats?.pendingApprovals)}</span>
              {!!stats?.pendingApprovals && (
                <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-bold">Review</span>
              )}
            </div>
            <Link href="/admin/approvals" className="text-[11px] text-blue-800 font-semibold hover:underline mt-2">
              Manage Enrolments →
            </Link>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active Geofences</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-slate-900">{value(stats?.activeDutyLocations)}</span>
              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold">Per Post</span>
            </div>
            <Link href="/admin/locations" className="text-[11px] text-blue-800 font-semibold hover:underline mt-2">
              View Map →
            </Link>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pending Tasks</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-slate-900">{value(stats?.pendingTasks)}</span>
              <span className="text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-bold">Supervision</span>
            </div>
            <Link href="/admin/tasks" className="text-[11px] text-blue-800 font-semibold hover:underline mt-2">
              Kanban Board →
            </Link>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Upcoming Events</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-slate-900">{value(stats?.upcomingEvents)}</span>
              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold">Bandobast</span>
            </div>
            <Link href="/admin/events" className="text-[11px] text-blue-800 font-semibold hover:underline mt-2">
              Planner →
            </Link>
          </div>
        </div>

        {/* Two-Column Operational Section: Live Muster & Pending Approvals */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Live Biometric & Geofenced Attendance */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Live Attendance & Geofence Log</h3>
              </div>
              <Link href="/admin/reports" className="text-xs font-semibold text-blue-800 hover:underline">
                Full Muster Log
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                    <th className="py-2.5 px-4">Personnel</th>
                    <th className="py-2.5 px-4">Service ID</th>
                    <th className="py-2.5 px-4">Duty Location</th>
                    <th className="py-2.5 px-4">Action</th>
                    <th className="py-2.5 px-4">Geofence Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {statsQuery.loading ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400 flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Reading the muster register...
                      </td>
                    </tr>
                  ) : recentAttendance.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400">
                        No GPS muster stamp has been recorded on this system yet.
                      </td>
                    </tr>
                  ) : (
                    recentAttendance.map((att) => (
                      <tr key={att.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {att.user?.full_name || 'Home Guard'}
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-blue-900">
                          {att.user?.personnel_id || 'Badge pending'}
                        </td>
                        <td className="py-3 px-4 text-slate-600 truncate max-w-[180px]">
                          {att.location?.name || 'Post no longer on file'}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              att.event_type === 'check_in'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {att.event_type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {att.is_within_geofence ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                              Verified ({Math.round(att.distance_meters)}m)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                              Outside ({Math.round(att.distance_meters)}m)
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pending Approvals Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-amber-50/40">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900">Pending Enlistments</h3>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                {pendingQuery.loading ? '…' : pendingApprovalsList.length}
              </span>
            </div>

            <div className="p-4 flex flex-col gap-3 flex-1 overflow-y-auto">
              {pendingQuery.loading ? (
                <div className="text-center py-8 text-slate-400 text-xs flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Reading pending enrolments...
                </div>
              ) : pendingQuery.error ? (
                <div className="text-center py-8 text-rose-600 text-xs">{pendingQuery.error}</div>
              ) : pendingApprovalsList.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  All volunteer enrolments have been processed.
                </div>
              ) : (
                pendingApprovalsList.slice(0, 4).map((p) => (
                  <div key={p.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex flex-col gap-2">
                    <div className="flex items-start justify-between">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-900">{p.full_name}</span>
                        <span className="text-[11px] text-slate-500">{p.email}</span>
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 text-slate-800">
                        {p.phone || 'No mobile'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-200/60">
                      <span className="text-slate-500 font-medium">District: {p.district?.name || 'Not chosen'}</span>
                      <Link
                        href="/admin/approvals"
                        className="text-blue-800 font-bold hover:underline"
                      >
                        Review Application →
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
            {pendingApprovalsList.length > 0 && (
              <div className="p-3 border-t border-slate-200 bg-slate-50 text-center">
                <Link
                  href="/admin/approvals"
                  className="text-xs font-bold text-blue-800 hover:text-blue-900"
                >
                  Go to Approvals Desk →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Administrative Trail */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-slate-600" />
              <h3 className="text-sm font-bold text-slate-900">Recent Administrative Actions</h3>
            </div>
            <span className="text-[11px] text-slate-400">Append-only trail from audit_logs</span>
          </div>

          {statsQuery.loading ? (
            <div className="p-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Reading the audit trail...
            </div>
          ) : recentAuditLogs.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              Nothing has been recorded yet. Approvals, deployments and directives each leave an entry here.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 text-xs">
              {recentAuditLogs.map((log) => (
                <li key={log.id} className="py-3 px-4 flex items-start justify-between gap-3 hover:bg-slate-50/70">
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-slate-900 truncate">{log.action.replace(/_/g, ' ')}</span>
                    <span className="text-[11px] text-slate-500">
                      {log.actor?.full_name || log.actor_email || 'System'}
                      {log.target_type && ` • ${log.target_type.replace(/_/g, ' ')}`}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 shrink-0">
                    {new Date(log.created_at).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
