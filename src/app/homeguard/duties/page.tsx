'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useLiveQuery } from '@/lib/hooks/useLiveQuery';
import { listDutyAssignments } from '@/lib/services/assignmentService';
import { useAuth } from '@/lib/auth/authContext';
import type { DutyAssignment } from '@/types';
import { AlertTriangle, CalendarCheck, MapPin, Clock, ArrowRight, Loader2 } from 'lucide-react';

/** `duty_assignments.start_time` is a Postgres TIME, so 'HH:MM:SS'. */
function clock(value: string | null | undefined): string {
  return value ? value.slice(0, 5) : '--:--';
}

const STATUS_STYLE: Record<string, string> = {
  scheduled: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-slate-100 text-slate-400 line-through',
  absent: 'bg-rose-100 text-rose-800',
};

export default function HomeGuardDutiesPage() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  // The roster is filtered by RLS: a guard calling this can only ever receive
  // their own rows, so the filter below is a convenience, not a control.
  const dutiesQuery = useLiveQuery<DutyAssignment[]>(
    () => (userId ? listDutyAssignments({ personnelId: userId }) : Promise.resolve({ data: [], error: null })),
    userId ?? 'no-user',
  );

  // The service returns the newest rows first, which is right for an audit but
  // wrong for a guard: the shift they can still report for is the next one, not
  // the last one. Completed and cancelled duties fall to the bottom.
  const duties = useMemo(() => {
    const rows = dutiesQuery.data ?? [];
    const isLive = (d: DutyAssignment) => (d.status === 'completed' || d.status === 'cancelled' ? 1 : 0);
    return [...rows].sort((a, b) => {
      if (isLive(a) !== isLive(b)) return isLive(a) - isLive(b);
      return `${a.duty_date} ${a.start_time}`.localeCompare(`${b.duty_date} ${b.start_time}`);
    });
  }, [dutiesQuery.data]);

  return (
    <DashboardLayout
      title="My Scheduled Duties"
      subtitle="Tamil Nadu Home Guards • Personnel Duty Roster"
    >
      <div className="max-w-4xl mx-auto flex flex-col gap-6">
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
          <h2 className="text-xl font-bold text-slate-900">
            Personal Duty Schedule {!dutiesQuery.loading && `(${duties.length})`}
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            Official deployment rosters assigned by Command Headquarters.
          </p>
        </div>

        {dutiesQuery.loading ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-8 flex items-center justify-center gap-2 text-xs text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading your duty roster...
          </div>
        ) : dutiesQuery.error ? (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Could not load your duties</span>
              <p className="mt-0.5">{dutiesQuery.error}</p>
              <button
                onClick={() => void dutiesQuery.refresh()}
                className="mt-2 px-3 py-1 rounded-lg border border-rose-300 text-rose-800 text-xs font-semibold hover:bg-rose-100 cursor-pointer"
              >
                Try again
              </button>
            </div>
          </div>
        ) : duties.length === 0 ? (
          <div className="bg-white p-8 rounded-xl border border-slate-200 text-center flex flex-col gap-2">
            <CalendarCheck className="w-6 h-6 text-slate-300 mx-auto" />
            <span className="text-sm font-bold text-slate-700">No duty assignments currently scheduled</span>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Your supervising officer has not posted a deployment against your badge yet. Check back after the
              next roster is published.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {duties.map((duty) => (
              <div
                key={duty.id}
                className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded">
                      {duty.duty_date.slice(0, 10)}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        STATUS_STYLE[duty.status] ?? 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {duty.status.replace('_', ' ')}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{duty.title}</h3>
                  {duty.description && <p className="text-xs text-slate-600">{duty.description}</p>}
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-blue-800" />
                      {duty.location?.name || 'Post to be advised'}
                    </span>
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {clock(duty.start_time)} - {clock(duty.end_time)}
                    </span>
                  </div>
                  {duty.reporting_instructions && (
                    <p className="text-[11px] text-slate-500 border-l-2 border-blue-200 pl-2">
                      {duty.reporting_instructions}
                    </p>
                  )}
                </div>

                <Link
                  href="/homeguard/location"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-800 hover:bg-blue-900 text-white font-bold text-xs shadow-xs transition-colors shrink-0"
                >
                  <span>Open Check-In</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
