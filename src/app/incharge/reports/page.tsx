'use client';

import { AttendanceReports } from '@/components/attendance/AttendanceReports';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

export default function InchargeReportsPage() {
  return <DashboardLayout title="Reports" subtitle="Disciplinary dossiers on file"><AttendanceReports /></DashboardLayout>;
}
