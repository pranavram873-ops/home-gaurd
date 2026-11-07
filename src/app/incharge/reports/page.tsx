'use client';

import { InchargePersonnelReports } from '@/components/reports/InchargePersonnelReports';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

export default function InchargeReportsPage() {
  return (
    <DashboardLayout title="Reports" subtitle="Disciplinary dossiers on file">
      <InchargePersonnelReports />
    </DashboardLayout>
  );
}
