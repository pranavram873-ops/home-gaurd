'use client';

import { AttendanceWorkspace } from '@/components/attendance/AttendanceWorkspace';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

export default function InchargeAttendancePage() {
  return <DashboardLayout title="District events" subtitle="Create an event and mark who attended"><AttendanceWorkspace /></DashboardLayout>;
}
