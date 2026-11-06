'use client';

import { AttendanceReports } from '@/components/attendance/AttendanceReports';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

export default function AdminReportsPage() {
  return <DashboardLayout title="Reports" subtitle="Command & disciplinary dossiers"><AttendanceReports /></DashboardLayout>;
}
