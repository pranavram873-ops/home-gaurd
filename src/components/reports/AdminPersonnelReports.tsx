'use client';

import { useEffect, useState } from 'react';
import { Card, Chip, EmptyState } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';
import { createClient } from '@/lib/supabase/client';

type PersonnelReport = { id: string; reporter_name: string; reporter_personnel_id: string | null; guard_name: string; home_guard_code: string; division_name: string; category: string; description: string; status: string; created_at: string };
const categoryName: Record<string, string> = { conduct: 'Conduct or behaviour', attendance: 'Attendance or duty', safety: 'Safety concern', other: 'Other' };

export function AdminPersonnelReports() {
  const [reports, setReports] = useState<PersonnelReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    createClient().from('personnel_reports').select('id,reporter_name,reporter_personnel_id,guard_name,home_guard_code,division_name,category,description,status,created_at').order('created_at', { ascending: false })
      .then(({ data, error: queryError }) => {
        if (!live) return;
        if (queryError) setError(queryError.message);
        else setReports((data ?? []) as PersonnelReport[]);
        setLoading(false);
      });
    return () => { live = false; };
  }, []);

  return <Card className="mt-5 overflow-hidden">
    <div className="border-b border-outline-variant/60 p-4"><h2 className="text-headline-sm text-on-surface">Incharge personnel reports</h2><p className="text-sm text-on-surface-variant">Reports filed about Home Guards from district rosters.</p></div>
    {error ? <p role="alert" className="p-4 text-sm text-on-error-container">Could not load personnel reports: {error}</p> : loading ? <p className="flex items-center justify-center gap-2 p-8 text-sm text-on-surface-variant"><Icon icon="sync" size={18} className="animate-spin" />Loading reports…</p> : reports.length ? <ul className="divide-y divide-outline-variant/60">{reports.map((report) => <li key={report.id} className="space-y-2 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold text-on-surface">{report.guard_name} <span className="font-mono text-xs text-on-surface-variant">{report.home_guard_code}</span></p><p className="text-xs text-on-surface-variant">{report.division_name} · {new Date(report.created_at).toLocaleString('en-IN')}</p></div><Chip tone={report.status === 'resolved' ? 'present' : 'live'}>{report.status === 'under_review' ? 'Under review' : report.status}</Chip></div>
      <p className="text-xs font-semibold uppercase tracking-wide text-secondary">{categoryName[report.category] ?? 'Other'}</p><p className="whitespace-pre-wrap text-sm text-on-surface">{report.description}</p><p className="text-xs text-on-surface-variant">Filed by {report.reporter_name}{report.reporter_personnel_id ? ` · ${report.reporter_personnel_id}` : ''}</p>
    </li>)}</ul> : <EmptyState icon="inbox" title="No incharge reports" body="Reports filed by incharges will appear here." />}
  </Card>;
}
