'use client';

import { AttendanceEvents } from '@/components/attendance/AttendanceEvents';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

export default function AdminDashboardPage() {
  return (
    <DashboardLayout title="Events" subtitle="Create events and manage attendance in your selected division">
      <AttendanceEvents />
    </DashboardLayout>
  );
}
