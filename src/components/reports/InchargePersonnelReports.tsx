'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Card, Chip, EmptyState } from '@/components/ui/primitives';
import { useAuth } from '@/lib/auth/authContext';
import { createClient } from '@/lib/supabase/client';

type GuardOption = { id: string; full_name: string; home_guard_code: string; division_id: string; division_name: string };
type FiledReport = { id: string; guard_name: string; home_guard_code: string; division_name: string; category: string; description: string; status: string; created_at: string };
const categoryOptions = [
  { value: 'conduct', label: 'Conduct or behaviour' },
  { value: 'attendance', label: 'Attendance or duty' },
  { value: 'safety', label: 'Safety concern' },
  { value: 'other', label: 'Other' },
];

export function InchargePersonnelReports() {
  const { user } = useAuth();
  const [guards, setGuards] = useState<GuardOption[]>([]);
  const [reports, setReports] = useState<FiledReport[]>([]);
  const [query, setQuery] = useState('');
  const [selectedGuard, setSelectedGuard] = useState<GuardOption | null>(null);
  const [category, setCategory] = useState('conduct');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    const supabase = createClient();
    const [rosterResult, reportResult] = await Promise.all([
      supabase.from('home_guard_roster').select('id,full_name,home_guard_code,division_id,attendance_divisions(name)').eq('is_active', true).order('full_name'),
      supabase.from('personnel_reports').select('id,guard_name,home_guard_code,division_name,category,description,status,created_at').eq('filed_by', user.id).order('created_at', { ascending: false }),
    ]);
    if (rosterResult.error || reportResult.error) {
      setError(rosterResult.error?.message ?? reportResult.error?.message ?? 'Could not load reports.');
    } else {
      const rosterRows = (rosterResult.data ?? []) as unknown as Array<{ id: string; full_name: string; home_guard_code: string; division_id: string; attendance_divisions: { name: string } | { name: string }[] | null }>;
      setGuards(rosterRows.map((row) => ({ id: row.id, full_name: row.full_name, home_guard_code: row.home_guard_code, division_id: row.division_id, division_name: Array.isArray(row.attendance_divisions) ? row.attendance_divisions[0]?.name ?? '' : row.attendance_divisions?.name ?? '' })));
      setReports((reportResult.data ?? []) as FiledReport[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const matches = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value || selectedGuard) return [];
    return guards.filter((guard) => `${guard.full_name} ${guard.home_guard_code} ${guard.division_name}`.toLowerCase().includes(value)).slice(0, 10);
  }, [guards, query, selectedGuard]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !selectedGuard || description.trim().length < 10) return;
    setSaving(true);
    setError('');
    setNotice('');
    const { error: insertError } = await createClient().from('personnel_reports').insert({
      filed_by: user.id,
      guard_id: selectedGuard.id,
      division_id: selectedGuard.division_id,
      category,
      description: description.trim(),
    });
    if (insertError) setError(insertError.message);
    else {
      setNotice(`Report filed for ${selectedGuard.full_name}. Administrators can review it.`);
      setDescription('');
      setQuery('');
      setSelectedGuard(null);
      await load();
    }
    setSaving(false);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-outline-variant/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="text-headline-sm text-on-surface">Personnel reports</h2><p className="text-sm text-on-surface-variant">File a report about a Home Guard in your roster.</p></div>
          <button type="button" aria-expanded={showForm} onClick={() => { setShowForm((value) => !value); setError(''); setNotice(''); }} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary-container px-4 text-label-md text-on-primary shadow-sm hover:bg-primary"><Icon icon={showForm ? 'close' : 'edit_document'} size={19} />{showForm ? 'Close form' : 'Create report'}</button>
        </div>
        {loading ? <div className="p-8 text-center text-sm text-on-surface-variant">Loading reports…</div> : reports.length ? (
          <ul className="divide-y divide-outline-variant/60">
            {reports.map((report) => <li key={report.id} className="space-y-2 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold text-on-surface">{report.guard_name} <span className="font-mono text-xs text-on-surface-variant">{report.home_guard_code}</span></p><p className="text-xs text-on-surface-variant">{report.division_name} · {new Date(report.created_at).toLocaleDateString('en-IN')}</p></div><Chip tone={report.status === 'resolved' ? 'present' : 'live'}>{report.status === 'under_review' ? 'Under review' : report.status}</Chip></div>
              <p className="text-xs font-semibold uppercase tracking-wide text-secondary">{categoryOptions.find((item) => item.value === report.category)?.label ?? 'Other'}</p><p className="whitespace-pre-wrap text-sm text-on-surface">{report.description}</p>
            </li>)}
          </ul>
        ) : <EmptyState icon="inbox" title="No reports filed yet" body="Use Create report to file a report about a Home Guard." />}
      </Card>
      {notice && <div role="status" className="rounded-xl bg-tertiary-fixed p-3 text-sm text-on-tertiary-fixed-variant">{notice}</div>}
      {error && <div role="alert" className="rounded-xl bg-error-container p-3 text-sm text-on-error-container">{error}</div>}

      {showForm && <Card className="p-4 sm:p-5">
        <div className="mb-4"><h2 className="text-headline-sm text-on-surface">Create report</h2><p className="text-sm text-on-surface-variant">Search by name or Home Guard code, choose the person, and describe what happened.</p></div>
        <form onSubmit={(event) => void submit(event)} className="space-y-4">
          <div>
            <label htmlFor="report-guard-search" className="mb-1.5 block text-label-md text-on-surface">Search Home Guards</label>
            <div className="relative"><Icon icon="search" size={19} className="absolute left-3 top-3 text-on-surface-variant" /><input id="report-guard-search" value={selectedGuard?.full_name ?? query} onChange={(event) => { setSelectedGuard(null); setQuery(event.target.value); }} placeholder="Type a name or Home Guard code" className="h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest pl-10 pr-10 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" />{selectedGuard && <button type="button" onClick={() => { setSelectedGuard(null); setQuery(''); }} aria-label="Clear selected Home Guard" className="absolute right-2 top-2 rounded-md p-1.5 text-on-surface-variant hover:bg-surface-container"><Icon icon="close" size={18} /></button>}</div>
            {!selectedGuard && query && <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto rounded-lg border border-outline-variant bg-surface-container-lowest p-1">{matches.length ? matches.map((guard) => <li key={guard.id}><button type="button" onClick={() => { setSelectedGuard(guard); setQuery(''); }} className="flex w-full items-center gap-3 rounded-lg p-3 text-left hover:bg-surface-container-low"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-fixed text-sm font-bold text-on-primary-fixed">{guard.full_name.split(/\s+/).slice(0,2).map((part) => part[0] ?? '').join('').toUpperCase()}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-on-surface">{guard.full_name}</span><span className="block truncate text-xs text-on-surface-variant">{guard.division_name} · HG code {guard.home_guard_code}</span></span><Icon icon="chevron_right" size={18} className="text-on-surface-variant" /></button></li>) : <li className="p-3 text-sm text-on-surface-variant">No Home Guards match that name or code.</li>}</ul>}
          </div>
          {selectedGuard && <div className="rounded-lg bg-primary-fixed p-3 text-sm text-on-primary-fixed"><strong>{selectedGuard.full_name}</strong><br />{selectedGuard.division_name} · HG code {selectedGuard.home_guard_code}</div>}
          <label className="block text-label-md text-on-surface">Report category<select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm"><option value="conduct">Conduct or behaviour</option><option value="attendance">Attendance or duty</option><option value="safety">Safety concern</option><option value="other">Other</option></select></label>
          <label className="block text-label-md text-on-surface">What happened?<textarea required minLength={10} maxLength={4000} rows={5} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the observed incident, including the relevant date or duty when known." className="mt-1.5 w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary" /></label>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => { setSelectedGuard(null); setQuery(''); setDescription(''); setError(''); }} className="min-h-11 rounded-lg px-4 text-label-md text-on-surface-variant hover:bg-surface-container">Clear</button><button type="submit" disabled={saving || !selectedGuard || description.trim().length < 10} className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary-container px-5 text-label-md text-on-primary disabled:opacity-50">{saving ? <Icon icon="sync" size={18} className="animate-spin" /> : <Icon icon="send" size={18} />}{saving ? 'Filing…' : 'File report'}</button></div>
        </form>
      </Card>}
    </div>
  );
}
