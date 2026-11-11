'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Chip, EmptyState, PrimaryButton } from '@/components/ui/primitives';
import { useAuth } from '@/lib/auth/authContext';
import { createClient } from '@/lib/supabase/client';
import { compressImage } from '@/lib/services/simpleAttendanceService';

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
  evidence_photo: string | null;
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

const statusTones: Record<ReportStatus, 'live' | 'present' | 'inverse'> = {
  submitted: 'live',
  under_review: 'live',
  resolved: 'present',
  dismissed: 'inverse',
};

const categories: { value: ReportCategory; label: string; icon: string }[] = [
  { value: 'attendance', label: 'Late / Absent from Duty', icon: 'schedule' },
  { value: 'conduct', label: 'Conduct or Insubordination', icon: 'warning' },
  { value: 'safety', label: 'Safety Concern', icon: 'shield_person' },
  { value: 'other', label: 'Other Disciplinary Issue', icon: 'notes' },
];

const categoryLabel = (value: ReportCategory) => categories.find((item) => item.value === value)?.label ?? 'Other concern';

const reportColumns =
  'id,reporter_id,reporter_name,reporter_personnel_id,subject_id,subject_name,subject_personnel_id,category,description,evidence_photo,status,resolution_note,created_at,updated_at';

const MAX_DESCRIPTION = 4000;

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase();
}

function memoTimestamp(date: Date) {
  return date.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function ComplaintCenter() {
  const { user, role } = useAuth();
  const isAdmin = role === 'admin';
  const [guards, setGuards] = useState<ReportableGuard[]>([]);
  const [reports, setReports] = useState<GuardReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [guardQuery, setGuardQuery] = useState('');
  const [category, setCategory] = useState<ReportCategory>('conduct');
  const [description, setDescription] = useState('');
  const [evidencePhoto, setEvidencePhoto] = useState<string | null>(null);
  const [compressingPhoto, setCompressingPhoto] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [adminDrafts, setAdminDrafts] = useState<Record<string, { status: ReportStatus; note: string }>>({});

  const load = useCallback(async () => {
    if (!user) {
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
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const reportableGuards = useMemo(() => guards.filter((guard) => guard.id !== user?.id), [guards, user?.id]);
  const submittedByMe = reports.filter((report) => report.reporter_id === user?.id);
  const aboutMe = reports.filter((report) => report.subject_id === user?.id);

  const candidates = useMemo(() => {
    const term = guardQuery.trim().toLowerCase();
    const filtered = term
      ? reportableGuards.filter((guard) => `${guard.full_name} ${guard.personnel_id ?? ''}`.toLowerCase().includes(term))
      : reportableGuards;
    return filtered.slice(0, 8);
  }, [guardQuery, reportableGuards]);

  const selectedGuard = reportableGuards.find((guard) => guard.id === subjectId) ?? null;
  const previousReports = subjectId ? reports.filter((report) => report.subject_id === subjectId).length : 0;

  function selectGuard(guard: ReportableGuard) {
    setSubjectId(guard.id);
    setGuardQuery('');
  }

  async function attachEvidencePhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setCompressingPhoto(true);
    setError('');
    try {
      setEvidencePhoto(await compressImage(file, 1200, 1200, 0.8));
    } catch {
      setError('Could not process that photo. Please choose another image.');
    } finally {
      setCompressingPhoto(false);
    }
  }

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
        ...(evidencePhoto ? { evidence_photo: evidencePhoto } : {}),
      });
      if (insertError) throw insertError;
      setDescription('');
      setEvidencePhoto(null);
      setSubjectId('');
      setGuardQuery('');
      setSuccess('Report recorded and routed to Command. The filing is visible to the administrator and the reported guard.');
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

  const reviewInputClass =
    'mt-1 w-full rounded-xl bg-surface-container-low px-3 py-2.5 text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary';

  function renderReviewCard(report: GuardReport, received = false) {
    const draft = adminDrafts[report.id] || { status: report.status, note: report.resolution_note || '' };
    return (
      <article key={report.id} className="card-hover-lift flex flex-col gap-3 rounded-xl bg-surface-container-lowest p-4 shadow-card transition-all duration-300 hover:shadow-md">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-label-lg font-bold text-on-surface">
              {isAdmin
                ? `${report.subject_name}${report.subject_personnel_id ? ` · ${report.subject_personnel_id}` : ''}`
                : received ? 'Report about you' : `Regarding ${report.subject_name}`}
            </p>
            <p className="mt-1 text-label-sm text-on-surface-variant">
              {`Filed by ${report.reporter_name}${report.reporter_personnel_id ? ` · ${report.reporter_personnel_id}` : ''} · `}
              {new Date(report.created_at).toLocaleString('en-IN')}
            </p>
          </div>
          <Chip tone={statusTones[report.status]}>{statusLabels[report.status]}</Chip>
        </div>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-surface-container-high px-2.5 py-1 text-label-sm text-on-surface">
          <Icon icon="assignment" size={14} className="text-secondary" />
          {categoryLabel(report.category)}
        </span>
        <p className="whitespace-pre-wrap rounded-lg bg-surface-container-low p-2.5 text-body-md text-sm leading-6 text-on-surface">
          {report.description}
        </p>
        {report.evidence_photo && <img src={report.evidence_photo} alt="Attached report evidence" className="max-h-52 w-fit max-w-full rounded-lg border border-outline-variant/60 object-contain" />}
        {report.resolution_note && !isAdmin && (
          <div className="rounded-lg bg-on-tertiary-container/10 p-3">
            <p className="text-label-sm font-bold uppercase text-on-tertiary-container">Command response</p>
            <p className="mt-1 whitespace-pre-wrap text-body-md text-sm text-on-tertiary-container">{report.resolution_note}</p>
          </div>
        )}
        {isAdmin && (
          <div className="grid gap-3 border-t border-outline-variant pt-4 md:grid-cols-[180px_1fr_auto] md:items-end">
            <label className="text-label-sm font-semibold text-on-surface-variant">
              Status
              <select
                className={`${reviewInputClass} bg-surface-container-lowest`}
                value={draft.status}
                onChange={(event) => setAdminDrafts((old) => ({ ...old, [report.id]: { ...draft, status: event.target.value as ReportStatus } }))}
              >
                {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="text-label-sm font-semibold text-on-surface-variant">
              Response visible to both personnel
              <textarea
                className={`${reviewInputClass} min-h-10 resize-y bg-surface-container-lowest`}
                rows={2}
                value={draft.note}
                maxLength={2000}
                onChange={(event) => setAdminDrafts((old) => ({ ...old, [report.id]: { ...draft, note: event.target.value } }))}
                placeholder="Add an update or outcome"
              />
            </label>
            <button
              type="button"
              onClick={() => void saveAdminUpdate(report.id)}
              disabled={saving}
              className="min-h-11 rounded-xl bg-primary-container px-4 py-2 text-label-md text-on-primary shadow-sm transition-transform active:scale-[0.98] disabled:opacity-50"
            >
              Save update
            </button>
          </div>
        )}
      </article>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      {/* Writer desk form. */}
      <section className="flex flex-col gap-5">
        <div className="flex flex-col gap-1 rounded-xl bg-surface-container-low p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary/10 px-2 py-0.5 text-label-sm uppercase tracking-wider text-secondary">
              <span className="beacon-pulse-red h-1.5 w-1.5 rounded-full bg-secondary" aria-hidden />
              Station Log Memo
            </span>
            <span className="flex items-center gap-1 text-label-sm text-on-surface-variant">
              <Icon icon="event" size={15} />
              {memoTimestamp(now)}
            </span>
          </div>
          <h2 className="text-headline-md tracking-tight text-on-surface">Report a Home Guard</h2>
          <p className="text-label-md text-on-surface-variant">Incharge Writer Desk • Official Non-Punitive Occurrence Entry</p>
        </div>

        {success && (
          <div role="status" className="alert-enter flex items-center justify-between gap-3 rounded-xl bg-tertiary-container p-3.5 text-on-tertiary-container shadow-md">
            <div className="flex min-w-0 items-center gap-2.5">
              <Icon icon="check_circle" size={24} className="shrink-0 text-tertiary-fixed" />
              <div className="flex min-w-0 flex-col">
                <span className="text-label-sm font-bold uppercase tracking-wide text-tertiary-fixed">Entry Acknowledged</span>
                <span className="truncate text-label-md">{success}</span>
              </div>
            </div>
            <button type="button" onClick={() => setSuccess('')} aria-label="Dismiss" className="rounded p-1 text-tertiary-fixed hover:bg-surface-container-lowest/10">
              <Icon icon="close" size={18} />
            </button>
          </div>
        )}

        {error && (
          <div role="alert" className="alert-enter flex items-start gap-2.5 rounded-lg bg-error-container p-3 text-on-error-container">
            <Icon icon="error" size={20} fill className="mt-0.5 shrink-0 text-error" />
            <span className="min-w-0 flex-1 text-sm">{error}</span>
          </div>
        )}

        <form onSubmit={submitReport} className="flex flex-col gap-6">
          {/* Field 2: Search & select guard. */}
          <div className="flex flex-col gap-2">
            <label htmlFor="guard-search" className="text-label-sm font-bold uppercase tracking-wider text-on-surface">
              2. Search &amp; Select Home Guard <span className="text-error">*</span>
            </label>
            <div className="relative flex items-center">
              <Icon icon="badge" size={20} className="absolute left-3.5 text-on-surface-variant" />
              <input
                id="guard-search"
                type="text"
                autoComplete="off"
                value={selectedGuard ? selectedGuard.full_name : guardQuery}
                onChange={(event) => { if (selectedGuard) setSubjectId(''); setGuardQuery(event.target.value); }}
                placeholder="Enter regimental ID or name..."
                disabled={!!selectedGuard}
                className="w-full rounded-xl bg-surface-container-lowest py-3 pl-11 pr-10 text-body-md text-on-surface shadow-sm ring-primary/20 focus:outline-none focus:ring-2 disabled:opacity-90"
              />
              {(guardQuery || selectedGuard) && (
                <button
                  type="button"
                  onClick={() => { setGuardQuery(''); setSubjectId(''); }}
                  aria-label="Clear selection"
                  className="absolute right-3 rounded-full p-1 text-on-surface-variant hover:bg-surface-container"
                >
                  <Icon icon="close" size={18} />
                </button>
              )}
            </div>

            {!selectedGuard && candidates.length > 0 && (
              <ul className="flex flex-col gap-1 rounded-xl bg-surface-container-low p-1">
                {candidates.map((guard) => (
                  <li key={guard.id}>
                    <button
                      type="button"
                      onClick={() => selectGuard(guard)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-surface-container-lowest"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-label-md font-bold text-on-primary-fixed">
                        {initials(guard.full_name)}
                      </span>
                      <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                        <span className="truncate text-body-md text-on-surface">{guard.full_name}</span>
                        {guard.personnel_id && (
                          <span className="shrink-0 rounded bg-surface-container-highest px-1.5 py-0.5 font-mono text-label-sm text-on-surface-variant">
                            {guard.personnel_id}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {!loading && reportableGuards.length === 0 && (
              <p className="text-label-sm text-on-surface-variant">There are no other active Home Guards available to report yet.</p>
            )}

            {selectedGuard && (
              <div className="flex flex-col gap-3 rounded-xl bg-surface-container-lowest p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-container text-headline-sm text-on-primary">
                      {initials(selectedGuard.full_name)}
                    </span>
                    <div className="flex min-w-0 flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-label-lg font-bold text-on-surface">{selectedGuard.full_name}</span>
                        {selectedGuard.personnel_id && (
                          <span className="shrink-0 rounded bg-surface-container-highest px-1.5 py-0.5 font-mono text-label-sm text-on-surface-variant">
                            {selectedGuard.personnel_id}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-tertiary-fixed px-2 py-1 text-label-sm font-bold text-on-tertiary-fixed">
                    <Icon icon="verified" size={14} />
                    Verified
                  </span>
                </div>
                {previousReports > 0 && (
                  <div className="flex items-start gap-2 rounded-lg bg-surface-container-high p-3">
                    <Icon icon="info" size={18} className="mt-0.5 shrink-0 text-secondary" />
                    <div className="flex min-w-0 flex-col">
                      <span className="text-label-md font-semibold text-on-surface">
                        {previousReports === 1 ? '1 previous report' : `${previousReports} previous reports`} on file for this guard
                      </span>
                      <p className="text-label-sm leading-relaxed text-on-surface-variant">
                        Informational record only. Does not constitute an official charge or disciplinary suspension.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Field 4: Type of concern. */}
          <div className="flex flex-col gap-2">
            <span className="text-label-sm font-bold uppercase tracking-wider text-on-surface">
              4. Type of Concern <span className="text-error">*</span>
            </span>
            <div className="flex flex-col gap-2">
              {categories.map((option) => {
                const selected = option.value === category;
                return (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-center justify-between rounded-xl p-3.5 shadow-sm transition-colors ${
                      selected ? 'bg-primary-container text-on-primary' : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container-low'
                    }`}
                  >
                    <input
                      type="radio"
                      name="concern-category"
                      value={option.value}
                      checked={selected}
                      onChange={() => setCategory(option.value)}
                      className="sr-only"
                    />
                    <span className="flex items-center gap-3">
                      <Icon icon={option.icon} size={20} className={selected ? 'text-secondary-container' : 'text-on-surface-variant'} />
                      <span className={`text-label-lg ${selected ? 'font-semibold' : ''}`}>{option.label}</span>
                    </span>
                    {selected ? (
                      <Icon icon="check_circle" size={22} fill className="text-secondary-container" />
                    ) : (
                      <span className="h-5 w-5 rounded-full bg-surface-container-high" aria-hidden />
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Field 5: What happened. */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label htmlFor="incident-description" className="text-label-sm font-bold uppercase tracking-wider text-on-surface">
                5. What happened? <span className="text-error">*</span>
              </label>
              <span className="text-label-sm text-on-surface-variant">GD Entry Format</span>
            </div>
            <div className="flex flex-col gap-2 rounded-xl bg-surface-container-lowest p-3 shadow-sm">
              <textarea
                id="incident-description"
                rows={4}
                required
                minLength={10}
                maxLength={MAX_DESCRIPTION}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe factual sequence, roll-call timings, and witness statements..."
                className="w-full resize-none bg-transparent text-body-md text-on-surface placeholder:text-outline focus:outline-none"
              />
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-on-surface-variant">
                  <Icon icon="translate" size={16} />
                  <span className="text-label-sm">Tamil / English accepted</span>
                </span>
                <span className="text-label-sm text-on-surface-variant">{description.length} / {MAX_DESCRIPTION} chars</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-label-sm font-bold uppercase tracking-wider text-on-surface">Evidence Photo <span className="font-normal normal-case tracking-normal text-on-surface-variant">(optional)</span></span>
            {evidencePhoto ? (
              <div className="flex items-center gap-3 rounded-xl bg-surface-container-lowest p-3 shadow-sm">
                <img src={evidencePhoto} alt="Evidence photo preview" className="h-14 w-20 rounded-md object-cover" />
                <div className="flex-1 text-sm font-semibold text-on-surface">Photo attached</div>
                <button type="button" onClick={() => setEvidencePhoto(null)} className="text-xs font-bold text-error underline">Remove</button>
              </div>
            ) : (
              <label className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest px-3 text-label-md font-semibold text-primary hover:bg-surface-container-low ${compressingPhoto ? 'pointer-events-none opacity-60' : ''}`}>
                {compressingPhoto ? <Icon icon="sync" size={18} className="animate-spin" /> : <Icon icon="add_photo_alternate" size={18} />}
                {compressingPhoto ? 'Processing photo…' : 'Attach evidence photo'}
                <input type="file" accept="image/*" className="sr-only" onChange={(event) => void attachEvidencePhoto(event)} disabled={compressingPhoto} />
              </label>
            )}
          </div>

          {/* Field 8: Primary action. */}
          <div className="flex flex-col gap-2 pt-1">
            <PrimaryButton type="submit" icon={saving ? null : 'arrow_forward'} disabled={saving || compressingPhoto || !subjectId || description.trim().length < 10}>
              {saving && <Icon icon="sync" size={20} className="animate-spin" />}
              Submit Incident Report
            </PrimaryButton>
            <span className="text-center text-label-sm text-on-surface-variant">
              Digital signature: {user?.full_name ?? 'Station Writer'}
              {user?.personnel_id ? ` · ${user.personnel_id}` : ''} • TNPG Authenticated
            </span>
          </div>
        </form>
      </section>

      {/* Review surfaces differ by role. */}
      {isAdmin ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-label-lg text-primary">Personnel reports</h3>
              <p className="mt-1 text-label-sm text-on-surface-variant">Review submissions and add an outcome visible to both personnel.</p>
            </div>
            <span className="rounded-full bg-surface-container-highest px-3 py-1 text-label-sm font-bold text-on-surface">{reports.length} total</span>
          </div>
          {loading ? (
            <p className="flex items-center justify-center gap-2 py-8 text-sm text-on-surface-variant"><Icon icon="sync" size={18} className="animate-spin" />Loading reports…</p>
          ) : reports.length ? (
            <div className="stagger-in flex flex-col gap-3">
              {reports.map((report) => renderReviewCard(report))}
            </div>
          ) : (
            <EmptyState icon="inbox" title="No personnel reports" body="No reports have been submitted yet." />
          )}
        </section>
      ) : (
        <>
          <ReportSection title="Reports about me" description="Reports submitted about you, with any administrator response." reports={aboutMe} loading={loading} empty="No reports have been filed about you." render={(report) => renderReviewCard(report, true)} />
          <ReportSection title="Reports I submitted" description="Follow the status of concerns you reported." reports={submittedByMe} loading={loading} empty="You have not submitted a report." render={(report) => renderReviewCard(report)} />
          <p className="flex items-start gap-2 rounded-lg bg-surface-container-low p-3 text-label-sm leading-5 text-on-surface-variant">
            <Icon icon="schedule" size={16} className="mt-0.5 shrink-0" />
            Report details are shared with the administrator and the Home Guard involved. Use the reporting process for operational concerns and include only relevant details.
          </p>
        </>
      )}
    </div>
  );
}

function ReportSection({ title, description, reports, loading, empty, render }: {
  title: string;
  description: string;
  reports: GuardReport[];
  loading: boolean;
  empty: string;
  render: (report: GuardReport) => React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="text-label-lg text-primary">{title} <span className="text-outline">({reports.length})</span></h3>
        <p className="mt-1 text-label-sm text-on-surface-variant">{description}</p>
      </div>
      {loading ? (
        <p className="py-5 text-sm text-on-surface-variant">Loading…</p>
      ) : reports.length ? (
        <div className="stagger-in flex flex-col gap-3">
          {reports.map(render)}
        </div>
      ) : (
        <EmptyState icon="inbox" title={empty} />
      )}
    </section>
  );
}
