'use client';

import { AttendanceWorkspace } from '@/components/attendance/AttendanceWorkspace';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

export default function AdminDashboardPage() {
  return <DashboardLayout title="Attendance" subtitle="Select a division and manage the daily roll call"><AttendanceWorkspace canAddGuards /></DashboardLayout>;
}
