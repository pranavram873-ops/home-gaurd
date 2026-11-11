'use client';

import { Suspense } from 'react';
import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { AttendanceEvents } from '@/components/attendance/AttendanceEvents';
import { AttendanceWorkspace } from '@/components/attendance/AttendanceWorkspace';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useDivision } from '@/lib/attendance/divisionContext';

function InchargeAttendanceContent() {
  const searchParams = useSearchParams();
  const { divisionId, setDivisionId } = useDivision();
  const date = searchParams.get('date');
  const requestedDivision = searchParams.get('division');
  const selectedEvent = date && /^\d{4}-\d{2}-\d{2}$/.test(date);

  useEffect(() => {
    if (requestedDivision && requestedDivision !== divisionId) setDivisionId(requestedDivision);
  }, [divisionId, requestedDivision, setDivisionId]);

  if (requestedDivision && divisionId !== requestedDivision) {
    return <p className="py-10 text-center text-sm text-on-surface-variant">Opening selected event…</p>;
  }

  return selectedEvent ? <AttendanceWorkspace /> : <AttendanceEvents forIncharge />;
}

export default function InchargeAttendancePage() {
  return <DashboardLayout title="Events" subtitle="Create events and manage attendance in your selected division">
    <Suspense fallback={<p className="py-10 text-center text-sm text-on-surface-variant">Loading events…</p>}>
      <InchargeAttendanceContent />
    </Suspense>
  </DashboardLayout>;
}
