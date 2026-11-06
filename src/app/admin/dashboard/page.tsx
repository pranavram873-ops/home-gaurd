'use client';

import { AttendanceEvents } from '@/components/attendance/AttendanceEvents';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

export default function AdminDashboardPage() {
  return (
    <DashboardLayout title="Attendance" subtitle="Review muster records">
      <AttendanceEvents />
    </DashboardLayout>
  );
}
