'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ComplaintCenter } from '@/components/reports/ComplaintCenter';

export default function HomeGuardReportsPage() {
  return (
    <DashboardLayout title="Personnel Reports" subtitle="Report a concern and follow reports involving you">
      <div className="mx-auto max-w-5xl">
        <ComplaintCenter />
      </div>
    </DashboardLayout>
  );
}
