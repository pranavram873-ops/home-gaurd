'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { EventPersonnelPicker } from '@/components/attendance/EventPersonnelPicker';

function PersonnelPickerInner() {
  const searchParams = useSearchParams();
  const divisionId = searchParams.get('division') ?? '';
  const date = searchParams.get('date') ?? '';
  const requestedBack = searchParams.get('back') ?? '';

  if (!divisionId || !date) {
    return <p className="rounded-xl bg-error-container p-4 text-sm text-on-error-container">Missing division or date for this event.</p>;
  }
  const backHref = requestedBack.startsWith('/incharge/attendance?date=')
    ? requestedBack
    : `/incharge/attendance?date=${encodeURIComponent(date)}`;
  return <EventPersonnelPicker divisionId={divisionId} date={date} backHref={backHref} />;
}

export default function InchargePersonnelPage() {
  return (
    <DashboardLayout title="Event personnel" subtitle="Select Home Guards for this muster">
      <Suspense fallback={<p className="p-8 text-center text-sm text-on-surface-variant">Loading personnel…</p>}>
        <PersonnelPickerInner />
      </Suspense>
    </DashboardLayout>
  );
}
