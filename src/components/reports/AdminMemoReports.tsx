'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Chip } from '@/components/ui/primitives';
import { createClient } from '@/lib/supabase/client';

type MemoReport = {
  id: string;
  reporter_name: string;
  reporter_personnel_id: string | null;
  subject_id: string;
  subject_name: string;
  subject_personnel_id: string | null;
  category: 'conduct' | 'attendance' | 'safety' | 'other';
  description: string;
  status: 'submitted' | 'under_review' | 'resolved' | 'dismissed';
  resolution_note: string | null;
  created_at: string;
};

const statuses: Record<MemoReport['status'], string> = {
  submitted: 'Submitted', under_review: 'Under review', resolved: 'Resolved', dismissed: 'Closed',
};
const categoryNames: Record<MemoReport['category'], string> = {
  conduct: 'Conduct', attendance: 'Attendance', safety: 'Safety', other: 'Other',
};

export function AdminMemoReports() {
  const [reports, setReports] = useState<MemoReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newMemo, setNewMemo] = useState<MemoReport | null>(null);
  const [filter, setFilter] = useState('');
  const load = useCallback(async () => {
    const { data, error: queryError } = await createClient()
      .from('guard_reports')
      .select('id,reporter_name,reporter_personnel_id,subject_id,subject_name,subject_personnel_id,category,description,status,resolution_note,created_at')
      .order('created_at', { ascending: false });
    if (queryError) setError(queryError.message);
    else { setReports((data ?? []) as MemoReport[]); setError(''); }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel('admin-guard-memos')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'guard_reports' }, (payload) => {
        const memo = payload.new as MemoReport;
        setNewMemo(memo);
        void load();
      }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load]);

  const counts = useMemo(() => {
    const grouped = new Map<string, { name: string; code: string | null; count: number }>();
    for (const report of reports) {
      const value = grouped.get(report.subject_id) ?? { name: report.subject_name, code: report.subject_personnel_id, count: 0 };
      value.count += 1;
      grouped.set(report.subject_id, value);
    }
    return [...grouped.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [reports]);
  const visible = reports.filter((report) => `${report.subject_name} ${report.subject_personnel_id ?? ''} ${report.reporter_name} ${report.description}`.toLowerCase().includes(filter.toLowerCase()));

  return <div className="mx-auto flex max-w-6xl flex-col gap-5">
    {newMemo && <div role="alert" className="flex items-start gap-3 rounded-xl border border-secondary/20 bg-secondary-fixed px-4 py-3 text-on-secondary-fixed-variant">
      <Icon icon="notifications_active" size={20} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1"><p className="font-bold">New memo reported</p><p className="text-sm">{newMemo.subject_name} now has {reports.filter((r) => r.subject_id === newMemo.subject_id).length + 1} memo(s) on file.</p></div>
      <button type="button" aria-label="Dismiss alert" onClick={() => setNewMemo(null)}><Icon icon="close" size={18} /></button>
    </div>}
    <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-card">
      <div className="mb-3 flex items-center gap-2"><Icon icon="assignment_late" size={20} className="text-primary"/><h2 className="font-bold text-on-surface">Memo totals by Home Guard</h2></div>
      {counts.length ? <div className="flex flex-wrap gap-2">{counts.map(([id, item]) => <div key={id} className="rounded-lg bg-surface-container-low px-3 py-2 text-sm"><span className="font-semibold">{item.name}</span>{item.code && <span className="text-on-surface-variant"> · {item.code}</span>}<span className="ml-2 rounded-full bg-primary-fixed px-2 py-0.5 font-bold text-on-primary-fixed">{item.count}</span></div>)}</div> : <p className="text-sm text-on-surface-variant">No memos have been filed.</p>}
    </section>
    <section className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-card">
      <div className="flex flex-col gap-3 border-b border-outline-variant p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold text-on-surface">Writer reports</h2><p className="text-sm text-on-surface-variant">{reports.length} memo(s) on file</p></div><input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search reports" aria-label="Search reports" className="h-10 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm"/></div>
      {loading ? <p className="p-8 text-center text-sm text-on-surface-variant">Loading reports…</p> : error ? <p role="alert" className="p-6 text-sm text-on-error-container">Could not load reports: {error}</p> : visible.length === 0 ? <p className="p-8 text-center text-sm text-on-surface-variant">No matching reports.</p> : <ul className="divide-y divide-outline-variant">{visible.map((report) => <li key={report.id} className="flex flex-col gap-2 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-bold text-on-surface">{report.subject_name}{report.subject_personnel_id ? ` · ${report.subject_personnel_id}` : ''}</p><p className="text-xs text-on-surface-variant">Reported by {report.reporter_name}{report.reporter_personnel_id ? ` · ${report.reporter_personnel_id}` : ''} · {new Date(report.created_at).toLocaleString('en-IN')}</p></div><Chip tone={report.status === 'resolved' ? 'present' : report.status === 'dismissed' ? 'inverse' : 'live'}>{statuses[report.status]}</Chip></div><p className="text-xs font-bold uppercase tracking-wide text-secondary">{categoryNames[report.category]}</p><p className="whitespace-pre-wrap text-sm text-on-surface">{report.description}</p>{report.resolution_note && <p className="rounded-lg bg-surface-container-low p-3 text-sm text-on-surface-variant"><strong>Admin response:</strong> {report.resolution_note}</p>}</li>)}</ul>}
    </section>
  </div>;
}
