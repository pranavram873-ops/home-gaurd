'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useLiveQuery } from '@/lib/hooks/useLiveQuery';
import { listDutyAssignments } from '@/lib/services/assignmentService';
import { useAuth } from '@/lib/auth/authContext';
import type { DutyAssignment } from '@/types';
import { Icon } from '@/components/ui/Icon';

/** `duty_assignments.start_time` is a Postgres TIME, so 'HH:MM:SS'. */
function clock(value: string | null | undefined): string {
  return value ? value.slice(0, 5) : '--:--';
}

const STATUS_STYLE: Record<string, string> = {
  scheduled: 'bg-surface-container text-on-surface-variant',
  in_progress: 'bg-primary-fixed text-primary',
  completed: 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
  cancelled: 'bg-surface-container text-outline line-through',
  absent: 'bg-error-container text-on-error-container',
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
        <div className="bg-surface-container-lowest rounded-xl p-5 border border-outline-variant shadow-xs">
          <h2 className="text-xl font-bold text-on-surface">
            Personal Duty Schedule {!dutiesQuery.loading && `(${duties.length})`}
          </h2>
          <p className="text-xs text-on-surface-variant mt-1">
            Official deployment rosters assigned by Command Headquarters.
          </p>
        </div>

        {dutiesQuery.loading ? (
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-xs p-8 flex items-center justify-center gap-2 text-xs text-on-surface-variant">
            <Icon icon="sync" size={16} className="animate-spin" />
            Loading your duty roster...
          </div>
        ) : dutiesQuery.error ? (
          <div className="p-4 rounded-xl bg-error-container border border-error-container text-on-error-container text-xs flex items-start gap-3">
            <Icon icon="warning" size={20} className="text-on-error-container shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Could not load your duties</span>
              <p className="mt-0.5">{dutiesQuery.error}</p>
              <button
                onClick={() => void dutiesQuery.refresh()}
                className="mt-2 px-3 py-1 rounded-lg border border-error-container text-on-error-container text-xs font-semibold hover:bg-error-container cursor-pointer"
              >
                Try again
              </button>
            </div>
          </div>
        ) : duties.length === 0 ? (
          <div className="bg-surface-container-lowest p-8 rounded-xl border border-outline-variant text-center flex flex-col gap-2">
            <Icon icon="fact_check" size={24} className="text-outline mx-auto" />
            <span className="text-sm font-bold text-on-surface-variant">No duty assignments currently scheduled</span>
            <p className="text-xs text-on-surface-variant max-w-md mx-auto">
              Your supervising officer has not posted a deployment against your badge yet. Check back after the
              next roster is published.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {duties.map((duty) => (
              <div
                key={duty.id}
                className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-xs p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-primary bg-primary-fixed px-2 py-0.5 rounded">
                      {duty.duty_date.slice(0, 10)}
                    </span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${
                        STATUS_STYLE[duty.status] ?? 'bg-surface-container text-on-surface-variant'
                      }`}
                    >
                      {duty.status.replace('_', ' ')}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-on-surface">{duty.title}</h3>
                  {duty.description && <p className="text-xs text-on-surface-variant">{duty.description}</p>}
                  <div className="flex flex-wrap items-center gap-4 text-xs text-on-surface-variant">
                    <span className="flex items-center gap-1">
                      <Icon icon="location_on" size={14} className="text-primary" />
                      {duty.location?.name || 'Post to be advised'}
                    </span>
                    <span className="flex items-center gap-1 font-mono">
                      <Icon icon="schedule" size={14} className="text-outline" />
                      {clock(duty.start_time)} - {clock(duty.end_time)}
                    </span>
                  </div>
                  {duty.reporting_instructions && (
                    <p className="text-[13px] text-on-surface-variant border-l-2 border-outline-variant pl-2">
                      {duty.reporting_instructions}
                    </p>
                  )}
                </div>

                <Link
                  href="/homeguard/location"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary text-on-primary font-bold text-xs shadow-xs transition-colors shrink-0"
                >
                  <span>Open Check-In</span>
                  <Icon icon="arrow_forward" size={16} />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
