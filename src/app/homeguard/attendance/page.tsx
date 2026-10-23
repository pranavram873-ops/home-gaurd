'use client';

import React, { useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useLiveQuery } from '@/lib/hooks/useLiveQuery';
import { listAttendance } from '@/lib/services/attendanceService';
import { useAuth } from '@/lib/auth/authContext';
import type { AttendanceEvent, AttendanceValidationStatus } from '@/types';
import { AlertTriangle, CheckCircle2, History, Loader2 } from 'lucide-react';

const VERDICT: Record<AttendanceValidationStatus, { label: string; className: string }> = {
  verified: { label: 'Inside Geofence', className: 'text-emerald-700' },
  flagged_distance: { label: 'Outside Perimeter', className: 'text-rose-700' },
  flagged_timing: { label: 'Timing Flagged', className: 'text-amber-700' },
  manual_override: { label: 'Manual Override', className: 'text-slate-700' },
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
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
          <h2 className="text-xl font-bold text-slate-900">
            Personal Muster Record {!historyQuery.loading && `(${attendance.length})`}
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            Official immutable log of GPS verified check-in and check-out stamps.
            {!historyQuery.loading && attendance.length > 0 && (
              <> {verifiedCount} verified against {attendance.length - verifiedCount} flagged.</>
            )}
          </p>
        </div>

        {historyQuery.loading ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-8 flex items-center justify-center gap-2 text-xs text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading your muster register...
          </div>
        ) : historyQuery.error ? (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Could not load your attendance history</span>
              <p className="mt-0.5">{historyQuery.error}</p>
              <button
                onClick={() => void historyQuery.refresh()}
                className="mt-2 px-3 py-1 rounded-lg border border-rose-300 text-rose-800 text-xs font-semibold hover:bg-rose-100 cursor-pointer"
              >
                Try again
              </button>
            </div>
          </div>
        ) : attendance.length === 0 ? (
          <div className="bg-white p-8 rounded-xl border border-slate-200 text-center flex flex-col gap-2">
            <History className="w-6 h-6 text-slate-300 mx-auto" />
            <span className="text-sm font-bold text-slate-700">No muster stamps recorded yet</span>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Use Duty Check-In on the geofence screen at your assigned post. Every stamp you make is listed here
              and cannot be edited afterwards.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-blue-900 text-white font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Duty Post Location</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Distance from Center</th>
                  <th className="py-3 px-4">Verification Status</th>
                  <th className="py-3 px-4 text-right">Date & Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {attendance.map((a) => {
                  const verdict = VERDICT[a.validation_status] ?? VERDICT.verified;
                  return (
                    <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {a.location?.name || 'Post no longer on file'}
                        {a.duty_assignment?.title && (
                          <span className="block font-normal text-slate-500 mt-0.5">
                            {a.duty_assignment.title} • {a.duty_assignment.duty_date.slice(0, 10)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            a.event_type === 'check_in' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {a.event_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">
                        {Math.round(a.distance_meters)} meters
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${verdict.className}`}>
                          {a.validation_status === 'verified' ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5" />
                          )}
                          {verdict.label}
                        </span>
                        {a.remarks && <span className="block text-[10px] text-slate-400 mt-0.5">{a.remarks}</span>}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-500">
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
