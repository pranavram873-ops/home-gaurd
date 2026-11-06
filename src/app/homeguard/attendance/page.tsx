'use client';

import React, { useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useLiveQuery } from '@/lib/hooks/useLiveQuery';
import { listAttendance } from '@/lib/services/attendanceService';
import { useAuth } from '@/lib/auth/authContext';
import type { AttendanceEvent, AttendanceValidationStatus } from '@/types';
import { Icon } from '@/components/ui/Icon';

const VERDICT: Record<AttendanceValidationStatus, { label: string; className: string }> = {
  verified: { label: 'Inside Geofence', className: 'text-on-tertiary-container' },
  flagged_distance: { label: 'Outside Perimeter', className: 'text-on-error-container' },
  flagged_timing: { label: 'Timing Flagged', className: 'text-on-secondary-fixed-variant' },
  manual_override: { label: 'Manual Override', className: 'text-on-surface-variant' },
};

export default function HomeGuardAttendancePage() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  // RLS already limits this to the signed-in guard's own stamps; the filter is
  // there so the query is not "everything a guard could ever see" by accident.
  const historyQuery = useLiveQuery<AttendanceEvent[]>(
    () => (userId ? listAttendance({ userId, limit: 200 }) : Promise.resolve({ data: [], error: null })),
    userId ?? 'no-user',
  );

  const attendance = useMemo(() => historyQuery.data ?? [], [historyQuery.data]);

  const verifiedCount = attendance.filter((a) => a.validation_status === 'verified').length;

  return (
    <DashboardLayout
      title="My Attendance & Biometric History"
      subtitle="Tamil Nadu Home Guards • Personnel Muster Register"
    >
      <div className="max-w-4xl mx-auto flex flex-col gap-6">
        <div className="bg-surface-container-lowest rounded-xl p-5 border border-outline-variant shadow-xs">
          <h2 className="text-xl font-bold text-on-surface">
            Personal Muster Record {!historyQuery.loading && `(${attendance.length})`}
          </h2>
          <p className="text-xs text-on-surface-variant mt-1">
            Official immutable log of GPS verified check-in and check-out stamps.
            {!historyQuery.loading && attendance.length > 0 && (
              <> {verifiedCount} verified against {attendance.length - verifiedCount} flagged.</>
            )}
          </p>
        </div>

        {historyQuery.loading ? (
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-xs p-8 flex items-center justify-center gap-2 text-xs text-on-surface-variant">
            <Icon icon="sync" size={16} className="animate-spin" />
            Loading your muster register...
          </div>
        ) : historyQuery.error ? (
          <div className="p-4 rounded-xl bg-error-container border border-error-container text-on-error-container text-xs flex items-start gap-3">
            <Icon icon="warning" size={20} className="text-on-error-container shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Could not load your attendance history</span>
              <p className="mt-0.5">{historyQuery.error}</p>
              <button
                onClick={() => void historyQuery.refresh()}
                className="mt-2 px-3 py-1 rounded-lg border border-error-container text-on-error-container text-xs font-semibold hover:bg-error-container cursor-pointer"
              >
                Try again
              </button>
            </div>
          </div>
        ) : attendance.length === 0 ? (
          <div className="bg-surface-container-lowest p-8 rounded-xl border border-outline-variant text-center flex flex-col gap-2">
            <Icon icon="history" size={24} className="text-outline mx-auto" />
            <span className="text-sm font-bold text-on-surface-variant">No muster stamps recorded yet</span>
            <p className="text-xs text-on-surface-variant max-w-md mx-auto">
              Use Duty Check-In on the geofence screen at your assigned post. Every stamp you make is listed here
              and cannot be edited afterwards.
            </p>
          </div>
        ) : (
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-primary text-on-primary font-bold uppercase tracking-wider text-[13px]">
                  <th className="py-3 px-4">Duty Post Location</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Distance from Center</th>
                  <th className="py-3 px-4">Verification Status</th>
                  <th className="py-3 px-4 text-right">Date & Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {attendance.map((a) => {
                  const verdict = VERDICT[a.validation_status] ?? VERDICT.verified;
                  return (
                    <tr key={a.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="py-3 px-4 font-bold text-on-surface">
                        {a.location?.name || 'Post no longer on file'}
                        {a.duty_assignment?.title && (
                          <span className="block font-normal text-on-surface-variant mt-0.5">
                            {a.duty_assignment.title} • {a.duty_assignment.duty_date.slice(0, 10)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                            a.event_type === 'check_in' ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant' : 'bg-surface-container text-on-surface-variant'
                          }`}
                        >
                          {a.event_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-on-surface">
                        {Math.round(a.distance_meters)} meters
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 text-[13px] font-bold ${verdict.className}`}>
                          {a.validation_status === 'verified' ? (
                            <Icon icon="check_circle" size={14} />
                          ) : (
                            <Icon icon="warning" size={14} />
                          )}
                          {verdict.label}
                        </span>
                        {a.remarks && <span className="block text-xs text-outline mt-0.5">{a.remarks}</span>}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-on-surface-variant">
                        {new Date(a.recorded_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} •{' '}
                        {new Date(a.recorded_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
