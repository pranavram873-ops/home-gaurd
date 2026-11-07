'use client';

import React from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useLiveQuery } from '@/lib/hooks/useLiveQuery';
import { getGuardDashboardStats, type GuardDashboardStats } from '@/lib/services/statsService';
import { useAuth } from '@/lib/auth/authContext';
import { Icon } from '@/components/ui/Icon';

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
        <div className="bg-surface-container-lowest rounded-xl p-5 border border-outline-variant shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-full bg-primary text-on-primary font-extrabold text-base flex items-center justify-center shrink-0 shadow-sm border border-outline-variant">
              {user?.full_name?.charAt(0) || 'G'}
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold font-mono text-on-primary-fixed bg-primary-fixed px-2 py-0.5 rounded border border-outline-variant">
                  {user?.personnel_id || 'Badge pending'}
                </span>
                <span className="text-xs font-bold text-on-tertiary-fixed-variant bg-tertiary-fixed px-1.5 py-0.5 rounded uppercase">
                  {user?.account_status === 'active' ? 'Active Cadre' : user?.account_status || 'Unverified'}
                </span>
              </div>
              <h2 className="text-lg font-bold text-on-surface tracking-tight mt-0.5">{user?.full_name}</h2>
              <span className="text-xs text-on-surface-variant">
                {user?.rank_designation || 'Home Guard Volunteer'}
                {(user?.unit?.name || user?.district?.name) && ' • '}
                {user?.unit?.name || user?.district?.name || 'Command unassigned'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-tertiary-fixed text-on-tertiary-fixed-variant border border-outline-variant text-xs font-semibold">
              <Icon icon="radio" size={14} className="text-on-tertiary-container animate-pulse" />
              <span>Geofenced Muster Enabled</span>
            </div>
          </div>
        </div>

        {statsQuery.error && (
          <div className="p-4 rounded-xl bg-error-container border border-error-container text-on-error-container text-xs flex items-start gap-3">
            <Icon icon="error" size={20} className="text-on-error-container shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Your duty summary could not be loaded</span>
              <p className="mt-0.5">{statsQuery.error}</p>
            </div>
          </div>
        )}

        {/* Today's Duty Assignment Card - Primary Focal Point */}
        <div className="bg-surface-container-lowest rounded-xl border-2 border-outline-variant/40 shadow-xs overflow-hidden">
          <div className="p-4 bg-gradient-to-r from-primary to-primary-container text-on-primary flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon icon="fact_check" size={20} className="text-on-secondary-container" />
              <h3 className="text-sm font-bold tracking-tight">Current Duty Assignment</h3>
            </div>
            <span className="text-[13px] font-mono px-2 py-0.5 rounded bg-primary text-on-primary font-bold uppercase">
              {statsQuery.loading ? 'LOADING' : todayAssignment?.status ? todayAssignment.status.replace('_', ' ') : 'NO DUTY'}
            </span>
          </div>

          <div className="p-5 flex flex-col gap-4">
            {statsQuery.loading ? (
              <div className="text-center py-8 text-on-surface-variant text-xs flex items-center justify-center gap-2">
                <Icon icon="sync" size={16} className="animate-spin" /> Reading your roster...
              </div>
            ) : todayAssignment ? (
              <>
                <div className="flex flex-col gap-1">
                  <h4 className="text-base font-extrabold text-on-surface">{todayAssignment.title}</h4>
                  <p className="text-xs text-on-surface-variant leading-relaxed">{todayAssignment.description}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-lg bg-surface-container-low border border-outline-variant text-xs">
                  <div>
                    <span className="text-xs font-bold text-on-surface-variant uppercase block">Duty Post Location</span>
                    <span className="font-semibold text-on-surface block mt-0.5">
                      {todayAssignment.location?.name || 'Post to be advised'}
                    </span>
                    <span className="text-[13px] text-on-surface-variant truncate block mt-0.5">
                      {todayAssignment.location?.address}
                    </span>
                  </div>

                  <div>
                    <span className="text-xs font-bold text-on-surface-variant uppercase block">Shift Hours</span>
                    <span className="font-mono font-bold text-primary text-sm block mt-0.5">
                      {clock(todayAssignment.start_time)} - {clock(todayAssignment.end_time)}
                    </span>
                    <span className="text-[13px] text-on-surface-variant block mt-0.5">
                      {todayAssignment.duty_date.slice(0, 10)}
                    </span>
                  </div>

                  <div>
                    <span className="text-xs font-bold text-on-surface-variant uppercase block">Reporting Supervisor</span>
                    {/* RLS lets a guard read only their own profile row, so the
                        embedded supervisor is null for them by design. The
                        command line beneath is drawn from the district and unit
                        the order itself carries, which are readable. */}
                    <span className="font-semibold text-on-surface block mt-0.5">
                      {todayAssignment.supervisor?.full_name || 'Per duty order'}
                    </span>
                    <span className="text-[13px] font-mono text-on-surface-variant block mt-0.5">
                      {todayAssignment.unit?.name || todayAssignment.district?.name || 'Command Headquarters'}
                    </span>
                  </div>
                </div>

                {todayAssignment.reporting_instructions && (
                  <div className="p-3 rounded-lg bg-secondary-fixed/70 border border-secondary-fixed text-xs text-on-secondary-fixed-variant">
                    <span className="font-bold block">Standing Orders & Instructions:</span>
                    <p className="text-[13px] mt-0.5 text-on-secondary-fixed-variant">{todayAssignment.reporting_instructions}</p>
                  </div>
                )}

                {/* Primary Action Button to Geofenced Check-in */}
                <div className="flex flex-col gap-3 pt-2">
                  <p className="text-sm text-on-surface-variant">
                    {lastAttendance ? (
                      <>
                        Last stamp:{' '}
                        <span className="font-semibold text-on-surface">{lastAttendance.event_type.replace('_', ' ')}</span>{' '}
                        on{' '}
                        {new Date(lastAttendance.recorded_at).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </>
                    ) : (
                      'No attendance stamped on this account yet.'
                    )}
                  </p>

                  <Link
                    href="/homeguard/location"
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-label-lg text-base text-on-primary shadow-md transition-transform hover:bg-primary-container active:scale-[0.98]"
                  >
                    <Icon icon="location_on" size={20} />
                    <span>Check In with GPS Now</span>
                  </Link>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-on-surface-variant text-xs">
                No duty is rostered against your badge. Contact Command HQ if you are on call today.
              </div>
            )}
          </div>
        </div>

        {/* Two-Column Grid: Tasks & Attendance History */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Assigned Tasks */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-xs p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-outline-variant mb-3">
                <div className="flex items-center gap-2">
                  <Icon icon="assignment" size={16} className="text-primary" />
                  <h3 className="text-sm font-bold text-on-surface">Assigned Operational Tasks</h3>
                </div>
                <Link href="/homeguard/tasks" className="text-xs font-semibold text-primary hover:underline">
                  All Tasks
                </Link>
              </div>

              <div className="flex flex-col gap-2.5">
                {statsQuery.loading ? (
                  <p className="text-xs text-on-surface-variant text-center py-4 flex items-center justify-center gap-2">
                    <Icon icon="sync" size={14} className="animate-spin" /> Loading your directives...
                  </p>
                ) : myTasks.length === 0 ? (
                  <p className="text-xs text-on-surface-variant text-center py-4">
                    No task has been issued against your badge.
                  </p>
                ) : (
                  myTasks.slice(0, 3).map((t) => (
                    <div key={t.id} className="p-3 rounded-lg border border-outline-variant bg-surface-container-low flex items-start justify-between gap-2">
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-on-surface leading-snug">{t.title}</span>
                        <span className="text-[13px] text-on-surface-variant mt-0.5">Priority: {t.priority}</span>
                      </div>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded uppercase shrink-0 ${
                          t.status === 'completed'
                            ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant'
                            : 'bg-primary-fixed text-on-primary-fixed'
                        }`}
                      >
                        {t.status.replace('_', ' ')}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-outline-variant">
              <Link
                href="/homeguard/tasks"
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-outline-variant text-on-surface-variant text-xs font-semibold hover:bg-surface-container-low transition-colors"
              >
                <span>Manage My Task Statuses</span>
                <Icon icon="arrow_forward" size={14} />
              </Link>
            </div>
          </div>

          {/* Personal Attendance History */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-xs p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-outline-variant mb-3">
                <div className="flex items-center gap-2">
                  <Icon icon="history" size={16} className="text-on-tertiary-container" />
                  <h3 className="text-sm font-bold text-on-surface">Recent Attendance Stamps</h3>
                </div>
                <Link href="/homeguard/attendance" className="text-xs font-semibold text-primary hover:underline">
                  Full History
                </Link>
              </div>

              <div className="flex flex-col gap-2.5">
                {statsQuery.loading ? (
                  <p className="text-xs text-on-surface-variant text-center py-4 flex items-center justify-center gap-2">
                    <Icon icon="sync" size={14} className="animate-spin" /> Reading your muster register...
                  </p>
                ) : myAttendance.length === 0 ? (
                  <p className="text-xs text-on-surface-variant text-center py-4">
                    No GPS stamp recorded on this account yet.
                  </p>
                ) : (
                  myAttendance.slice(0, 3).map((a) => (
                    <div key={a.id} className="p-3 rounded-lg border border-outline-variant bg-surface-container-low flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-on-surface">{a.location?.name || 'Post no longer on file'}</span>
                        <span className="text-[13px] text-on-surface-variant">
                          {new Date(a.recorded_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} • {new Date(a.recorded_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${
                            a.event_type === 'check_in' ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant' : 'bg-surface-container-high text-on-surface-variant'
                          }`}
                        >
                          {a.event_type.replace('_', ' ')}
                        </span>
                        <span
                          className={`block text-xs font-semibold mt-0.5 ${
                            a.is_within_geofence ? 'text-on-tertiary-container' : 'text-on-error-container'
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

            <div className="mt-4 pt-3 border-t border-outline-variant">
              <Link
                href="/homeguard/location"
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-on-tertiary-container text-on-primary text-xs font-bold hover:bg-on-tertiary-container transition-colors"
              >
                <Icon icon="check_circle" size={16} />
                <span>Perform New Check-In</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
