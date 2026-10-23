'use client';

import React from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useLiveQuery } from '@/lib/hooks/useLiveQuery';
import { getGuardDashboardStats, type GuardDashboardStats } from '@/lib/services/statsService';
import { useAuth } from '@/lib/auth/authContext';
import {
  MapPin,
  CalendarCheck,
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  History,
  Radio,
  Loader2,
} from 'lucide-react';

/** `duty_assignments.start_time` is a Postgres TIME, so 'HH:MM:SS'. */
function clock(value: string | null | undefined): string {
  return value ? value.slice(0, 5) : '--:--';
}

export default function HomeGuardDashboardPage() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  // One round of three reads, all of which RLS already narrows to this guard.
  const statsQuery = useLiveQuery<GuardDashboardStats | null>(
    () =>
      userId
        ? getGuardDashboardStats(userId)
        : Promise.resolve({ data: null, error: 'Sign in to see your duty summary.' }),
    userId ?? 'no-user',
  );

  const stats = statsQuery.data;
  const todayAssignment = stats?.myActiveDuty ?? null;
  const myTasks = stats?.myTasks ?? [];
  const myAttendance = stats?.recentAttendance ?? [];
  const lastAttendance = myAttendance[0] ?? null;

  return (
    <DashboardLayout
      title="Home Guard Duty Portal"
      subtitle="Tamil Nadu Home Guards • Personnel Operations Desk"
    >
      <div className="flex flex-col gap-6 max-w-5xl mx-auto">
        {/* Guard Identification Banner */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-full bg-blue-800 text-white font-extrabold text-base flex items-center justify-center shrink-0 shadow-sm border border-blue-900">
              {user?.full_name?.charAt(0) || 'G'}
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold font-mono text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {user?.personnel_id || 'Badge pending'}
                </span>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded uppercase">
                  {user?.account_status === 'active' ? 'Active Cadre' : user?.account_status || 'Unverified'}
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight mt-0.5">{user?.full_name}</h2>
              <span className="text-xs text-slate-500">
                {user?.rank_designation || 'Home Guard Volunteer'}
                {(user?.unit?.name || user?.district?.name) && ' • '}
                {user?.unit?.name || user?.district?.name || 'Command unassigned'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
              <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
              <span>Geofenced Muster Enabled</span>
            </div>
          </div>
        </div>

        {statsQuery.error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Your duty summary could not be loaded</span>
              <p className="mt-0.5">{statsQuery.error}</p>
            </div>
          </div>
        )}

        {/* Today's Duty Assignment Card - Primary Focal Point */}
        <div className="bg-white rounded-xl border-2 border-blue-800/40 shadow-xs overflow-hidden">
          <div className="p-4 bg-gradient-to-r from-blue-900 to-blue-800 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-blue-200" />
              <h3 className="text-sm font-bold tracking-tight">Current Duty Assignment</h3>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-700 text-blue-100 font-bold uppercase">
              {statsQuery.loading ? 'LOADING' : todayAssignment?.status ? todayAssignment.status.replace('_', ' ') : 'NO DUTY'}
            </span>
          </div>

          <div className="p-5 flex flex-col gap-4">
            {statsQuery.loading ? (
              <div className="text-center py-8 text-slate-400 text-xs flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Reading your roster...
              </div>
            ) : todayAssignment ? (
              <>
                <div className="flex flex-col gap-1">
                  <h4 className="text-base font-extrabold text-slate-900">{todayAssignment.title}</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">{todayAssignment.description}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Duty Post Location</span>
                    <span className="font-semibold text-slate-800 block mt-0.5">
                      {todayAssignment.location?.name || 'Post to be advised'}
                    </span>
                    <span className="text-[11px] text-slate-500 truncate block mt-0.5">
                      {todayAssignment.location?.address}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Shift Hours</span>
                    <span className="font-mono font-bold text-blue-900 text-sm block mt-0.5">
                      {clock(todayAssignment.start_time)} - {clock(todayAssignment.end_time)}
                    </span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      {todayAssignment.duty_date.slice(0, 10)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Reporting Supervisor</span>
                    {/* RLS lets a guard read only their own profile row, so the
                        embedded supervisor is null for them by design. The
                        command line beneath is drawn from the district and unit
                        the order itself carries, which are readable. */}
                    <span className="font-semibold text-slate-800 block mt-0.5">
                      {todayAssignment.supervisor?.full_name || 'Per duty order'}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500 block mt-0.5">
                      {todayAssignment.unit?.name || todayAssignment.district?.name || 'Command Headquarters'}
                    </span>
                  </div>
                </div>

                {todayAssignment.reporting_instructions && (
                  <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200 text-xs text-amber-900">
                    <span className="font-bold block">Standing Orders & Instructions:</span>
                    <p className="text-[11px] mt-0.5 text-amber-800">{todayAssignment.reporting_instructions}</p>
                  </div>
                )}

                {/* Primary Action Button to Geofenced Check-in */}
                <div className="flex items-center justify-between pt-2">
                  <div className="text-xs text-slate-500">
                    {lastAttendance ? (
                      <span>
                        Last stamp: {lastAttendance.event_type.replace('_', ' ')} on{' '}
                        {new Date(lastAttendance.recorded_at).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    ) : (
                      <span>No attendance stamped on this account yet.</span>
                    )}
                  </div>

                  <Link
                    href="/homeguard/location"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-800 text-white font-bold text-xs hover:bg-blue-900 shadow-sm transition-all"
                  >
                    <MapPin className="w-4 h-4" />
                    <span>Proceed to GPS Check-In</span>
                  </Link>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-slate-400 text-xs">
                No duty is rostered against your badge. Contact Command HQ if you are on call today.
              </div>
            )}
          </div>
        </div>

        {/* Two-Column Grid: Tasks & Attendance History */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Assigned Tasks */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-indigo-700" />
                  <h3 className="text-sm font-bold text-slate-900">Assigned Operational Tasks</h3>
                </div>
                <Link href="/homeguard/tasks" className="text-xs font-semibold text-blue-800 hover:underline">
                  All Tasks
                </Link>
              </div>

              <div className="flex flex-col gap-2.5">
                {statsQuery.loading ? (
                  <p className="text-xs text-slate-400 text-center py-4 flex items-center justify-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading your directives...
                  </p>
                ) : myTasks.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">
                    No task has been issued against your badge.
                  </p>
                ) : (
                  myTasks.slice(0, 3).map((t) => (
                    <div key={t.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-start justify-between gap-2">
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-slate-900 leading-snug">{t.title}</span>
                        <span className="text-[11px] text-slate-500 mt-0.5">Priority: {t.priority}</span>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase shrink-0 ${
                          t.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {t.status.replace('_', ' ')}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100">
              <Link
                href="/homeguard/tasks"
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
              >
                <span>Manage My Task Statuses</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Personal Attendance History */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-emerald-700" />
                  <h3 className="text-sm font-bold text-slate-900">Recent Attendance Stamps</h3>
                </div>
                <Link href="/homeguard/attendance" className="text-xs font-semibold text-blue-800 hover:underline">
                  Full History
                </Link>
              </div>

              <div className="flex flex-col gap-2.5">
                {statsQuery.loading ? (
                  <p className="text-xs text-slate-400 text-center py-4 flex items-center justify-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Reading your muster register...
                  </p>
                ) : myAttendance.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">
                    No GPS stamp recorded on this account yet.
                  </p>
                ) : (
                  myAttendance.slice(0, 3).map((a) => (
                    <div key={a.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-900">{a.location?.name || 'Post no longer on file'}</span>
                        <span className="text-[11px] text-slate-500">
                          {new Date(a.recorded_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} • {new Date(a.recorded_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                            a.event_type === 'check_in' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {a.event_type.replace('_', ' ')}
                        </span>
                        <span
                          className={`block text-[10px] font-semibold mt-0.5 ${
                            a.is_within_geofence ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {a.is_within_geofence ? '✓' : '⚠'} {Math.round(a.distance_meters)}m
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100">
              <Link
                href="/homeguard/location"
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Perform New Check-In</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
