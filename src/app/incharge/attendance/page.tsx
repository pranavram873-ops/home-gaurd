'use client';

import { AttendanceWorkspace } from '@/components/attendance/AttendanceWorkspace';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

export default function InchargeAttendancePage() {
  return <DashboardLayout title="Attendance" subtitle="Select your division and mark today’s roll call"><AttendanceWorkspace /></DashboardLayout>;
}
