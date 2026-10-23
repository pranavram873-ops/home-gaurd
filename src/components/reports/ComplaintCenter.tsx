'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, FileText, LoaderCircle, Send } from 'lucide-react';
import { useAuth } from '@/lib/auth/authContext';
import { createClient } from '@/lib/supabase/client';

type ReportStatus = 'submitted' | 'under_review' | 'resolved' | 'dismissed';
type ReportCategory = 'conduct' | 'attendance' | 'safety' | 'other';

interface ReportableGuard {
  id: string;
  full_name: string;
  personnel_id: string | null;
  unit_id: string | null;
}

interface GuardReport {
  id: string;
  reporter_id: string;
  reporter_name: string;
  reporter_personnel_id: string | null;
  subject_id: string;
  subject_name: string;
  subject_personnel_id: string | null;
  category: ReportCategory;
  description: string;
  status: ReportStatus;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
}

const statusLabels: Record<ReportStatus, string> = {
  submitted: 'Submitted',
  under_review: 'Under review',
  resolved: 'Resolved',
  dismissed: 'Closed',
};

const statusStyles: Record<ReportStatus, string> = {
  submitted: 'bg-blue-50 text-blue-800 border-blue-200',
  under_review: 'bg-amber-50 text-amber-800 border-amber-200',
  resolved: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  dismissed: 'bg-slate-100 text-slate-700 border-slate-200',
};

const categories: { value: ReportCategory; label: string }[] = [
  { value: 'conduct', label: 'Conduct or professionalism' },
  { value: 'attendance', label: 'Attendance or duty concern' },
  { value: 'safety', label: 'Safety concern' },
  { value: 'other', label: 'Other concern' },
];

const reportColumns = 'id,reporter_id,reporter_name,reporter_personnel_id,subject_id,subject_name,subject_personnel_id,category,description,status,resolution_note,created_at,updated_at';

export function ComplaintCenter() {
  const { user, role, demoMode } = useAuth();
  const isAdmin = role === 'admin';
  const [guards, setGuards] = useState<ReportableGuard[]>([]);
  const [reports, setReports] = useState<GuardReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [category, setCategory] = useState<ReportCategory>('conduct');
  const [description, setDescription] = useState('');
  const [adminDrafts, setAdminDrafts] = useState<Record<string, { status: ReportStatus; note: string }>>({});

  const load = useCallback(async () => {
    if (!user || demoMode) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const supabase = createClient();
      const [guardResult, reportResult] = await Promise.all([
        supabase.rpc('list_reportable_home_guards'),
        supabase.from('guard_reports').select(reportColumns).order('created_at', { ascending: false }),
      ]);
      if (guardResult.error) throw guardResult.error;
      if (reportResult.error) throw reportResult.error;
      const nextReports = (reportResult.data || []) as GuardReport[];
      setGuards((guardResult.data || []) as ReportableGuard[]);
      setReports(nextReports);
      setAdminDrafts((previous) => {
        const drafts = { ...previous };
        for (const report of nextReports) {
          if (!drafts[report.id]) {
            drafts[report.id] = { status: report.status, note: report.resolution_note || '' };
          }
        }
        return drafts;
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load reports. Check the database migration and try again.');
    } finally {
      setLoading(false);
    }
  }, [demoMode, user]);

  useEffect(() => { void load(); }, [load]);

  const reportableGuards = useMemo(() => guards.filter((guard) => guard.id !== user?.id), [guards, user?.id]);
  const submittedByMe = reports.filter((report) => report.reporter_id === user?.id);
  const aboutMe = reports.filter((report) => report.subject_id === user?.id);

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !subjectId || description.trim().length < 10) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const supabase = createClient();
      const { error: insertError } = await supabase.from('guard_reports').insert({
        reporter_id: user.id,
        subject_id: subjectId,
        category,
        description: description.trim(),
      });
      if (insertError) throw insertError;
      setDescription('');
      setSubjectId('');
      setSuccess('Your report was submitted to the administrator and the reported Home Guard.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not submit the report. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function saveAdminUpdate(reportId: string) {
    const draft = adminDrafts[reportId];
    if (!draft) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from('guard_reports')
        .update({ status: draft.status, resolution_note: draft.note.trim() || null })
        .eq('id', reportId);
      if (updateError) throw updateError;
      setSuccess('Report status and response saved.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update this report. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100';

  function renderReportCard(report: GuardReport, received = false) {
    const draft = adminDrafts[report.id] || { status: report.status, note: report.resolution_note || '' };
    return (
      <article key={report.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-slate-900">
              {isAdmin
                ? `${report.subject_name} · ${report.subject_personnel_id || 'No personnel ID'}`
                : received ? 'Report about you' : `Regarding ${report.subject_name}`}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {`Reported by ${report.reporter_name}${report.reporter_personnel_id ? ` · ${report.reporter_personnel_id}` : ''} · `}
              {new Date(report.created_at).toLocaleString('en-IN')}
            </p>
          </div>
          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusStyles[report.status]}`}>
            {statusLabels[report.status]}
          </span>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-blue-900">
          <span className="rounded-md bg-blue-50 px-2 py-1">{categories.find((item) => item.value === report.category)?.label || 'Other concern'}</span>
        </div>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{report.description}</p>
        {report.resolution_note && !isAdmin && (
          <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 p-3">
            <p className="text-xs font-bold text-emerald-900">Administrator response</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-emerald-900">{report.resolution_note}</p>
          </div>
        )}
        {isAdmin && (
          <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-[180px_1fr_auto] md:items-end">
            <label className="text-xs font-semibold text-slate-600">
              Status
              <select
                className={`${inputClass} mt-1`}
                value={draft.status}
                onChange={(event) => setAdminDrafts((old) => ({ ...old, [report.id]: { ...draft, status: event.target.value as ReportStatus } }))}
              >
                {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Response visible to both personnel
              <textarea
                className={`${inputClass} mt-1 min-h-10 resize-y`}
                rows={2}
                value={draft.note}
                maxLength={2000}
                onChange={(event) => setAdminDrafts((old) => ({ ...old, [report.id]: { ...draft, note: event.target.value } }))}
                placeholder="Add an update or outcome"
              />
            </label>
            <button type="button" onClick={() => void saveAdminUpdate(report.id)} disabled={saving} className="rounded-lg bg-blue-800 px-4 py-2 text-xs font-bold text-white hover:bg-blue-900 disabled:opacity-50">
              Save update
            </button>
          </div>
        )}
      </article>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {demoMode && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Reports are available after Supabase is connected and the guard reports migration is applied.
        </div>
      )}
      {!demoMode && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-800"><FileText className="h-5 w-5" /></span>
            <div>
              <h2 className="text-base font-bold text-slate-900">Submit a personnel report</h2>
              <p className="mt-1 text-xs text-slate-600">Reports are shared with the administrator and the Home Guard named in the report.</p>
            </div>
          </div>
          <form onSubmit={submitReport} className="grid gap-3 md:grid-cols-2">
            <label className="text-xs font-semibold text-slate-600">
              Home Guard
              <select className={`${inputClass} mt-1`} required value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
                <option value="">Choose a Home Guard</option>
                {reportableGuards.map((guard) => <option key={guard.id} value={guard.id}>{guard.full_name}{guard.personnel_id ? ` · ${guard.personnel_id}` : ''}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Report category
              <select className={`${inputClass} mt-1`} value={category} onChange={(event) => setCategory(event.target.value as ReportCategory)}>
                {categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600 md:col-span-2">
              What happened?
              <textarea className={`${inputClass} mt-1 min-h-28 resize-y`} required minLength={10} maxLength={4000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the concern clearly, including relevant dates or duty details." />
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3 md:col-span-2">
              <p className="text-[11px] text-slate-500">Your name and personnel ID will be visible to the administrator and reported Home Guard.</p>
              <button type="submit" disabled={saving || !reportableGuards.length} className="inline-flex items-center gap-2 rounded-lg bg-blue-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-50">
                {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Submit report
              </button>
            </div>
          </form>
          {!loading && !reportableGuards.length && <p className="mt-3 text-xs text-amber-800">There are no other active Home Guards available to report yet.</p>}
        </section>
      )}

      {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"><AlertTriangle className="mr-2 inline h-4 w-4" />{error}</div>}
      {success && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><CheckCircle2 className="mr-2 inline h-4 w-4" />{success}</div>}

      {isAdmin ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div><h2 className="text-base font-bold text-slate-900">Personnel reports</h2><p className="mt-1 text-xs text-slate-500">Review submissions and add an outcome visible to both personnel.</p></div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{reports.length} total</span>
          </div>
          {loading ? <p className="py-8 text-center text-sm text-slate-500">Loading reports…</p> : reports.length ? reports.map((report) => renderReportCard(report)) : <EmptyState text="No personnel reports have been submitted." />}
        </section>
      ) : (
        <>
          <ReportSection title="Reports about me" description="Reports submitted about you, with any administrator response." reports={aboutMe} loading={loading} empty="No reports have been filed about you." render={(report) => renderReportCard(report, true)} />
          <ReportSection title="Reports I submitted" description="Follow the status of concerns you reported." reports={submittedByMe} loading={loading} empty="You have not submitted a report." render={(report) => renderReportCard(report)} />
        </>
      )}
      {!isAdmin && <p className="flex items-start gap-2 rounded-lg bg-slate-100 p-3 text-xs leading-5 text-slate-600"><Clock3 className="mt-0.5 h-4 w-4 shrink-0" />Report details are shared with the administrator and the Home Guard involved. Use the reporting process for operational concerns and include only relevant details.</p>}
    </div>
  );
}

function ReportSection({ title, description, reports, loading, empty, render }: {
  title: string;
  description: string;
  reports: GuardReport[];
  loading: boolean;
  empty: string;
  render: (report: GuardReport) => ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div><h2 className="text-base font-bold text-slate-900">{title} <span className="text-slate-400">({reports.length})</span></h2><p className="mt-1 text-xs text-slate-500">{description}</p></div>
      {loading ? <p className="py-5 text-sm text-slate-500">Loading…</p> : reports.length ? reports.map(render) : <EmptyState text={empty} />}
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">{text}</div>;
}
