'use client';

import { AttendanceReports } from '@/components/attendance/AttendanceReports';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AdminPersonnelReports } from '@/components/reports/AdminPersonnelReports';

export default function AdminReportsPage() {
  return (
    <DashboardLayout title="Reports" subtitle="Memos and statewide operational reporting">
      <AttendanceReports />
      <AdminPersonnelReports />
    </DashboardLayout>
  );
}
