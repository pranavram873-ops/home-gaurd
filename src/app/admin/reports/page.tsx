'use client';

import { useState } from 'react';
import { AttendanceReports } from '@/components/attendance/AttendanceReports';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AdminPersonnelReports } from '@/components/reports/AdminPersonnelReports';

export default function AdminReportsPage() {
  const [search, setSearch] = useState('');

  return (
    <DashboardLayout title="Reports" subtitle="Memos and statewide operational reporting">
      <AttendanceReports search={search} onSearchChange={setSearch}>
        <AdminPersonnelReports searchTerm={search} />
      </AttendanceReports>
    </DashboardLayout>
  );
}
