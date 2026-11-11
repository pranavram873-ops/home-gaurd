'use client';

import React, { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { EventPersonnelPicker } from '@/components/attendance/EventPersonnelPicker';
import { parseAttendanceEventId } from '@/lib/services/simpleAttendanceService';

export default function AdminEventPersonnelPage() {
  const params = useParams<{ id: string }>();
  const rawId = Array.isArray(params?.id) ? params.id[0] : params?.id ?? '';
  const parsed = useMemo(() => parseAttendanceEventId(rawId), [rawId]);

  return (
    <DashboardLayout title="Event personnel" subtitle="Select Home Guards for this muster">
      {parsed ? (
        <EventPersonnelPicker divisionId={parsed.divisionId} date={parsed.date} backHref={`/admin/events/${rawId}`} />
      ) : (
        <p className="rounded-xl bg-error-container p-4 text-sm text-on-error-container">This muster record link is not valid.</p>
      )}
    </DashboardLayout>
  );
}
