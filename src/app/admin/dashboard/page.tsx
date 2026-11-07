'use client';

import { AttendanceEvents } from '@/components/attendance/AttendanceEvents';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

export default function AdminDashboardPage() {
  return (
    <DashboardLayout title="Events" subtitle="Events and muster records from every district">
      <AttendanceEvents />
    </DashboardLayout>
  );
}
