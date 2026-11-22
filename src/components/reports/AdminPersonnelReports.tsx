'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import Link from 'next/link';
import { Card, Chip, EmptyState } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';
import { createClient } from '@/lib/supabase/client';
import { HomeGuardProfileLink } from '@/components/attendance/HomeGuardProfileLink';
import { useDivision } from '@/lib/attendance/divisionContext';
import { useAuth } from '@/lib/auth/authContext';
import { compressImage, filePersonnelReport } from '@/lib/services/simpleAttendanceService';
import { EvidencePhotoPreview } from '@/components/reports/EvidencePhotoPreview';
import { EventNameAutocomplete } from '@/components/reports/EventNameAutocomplete';
import { ReportAcknowledgementDialog } from '@/components/reports/ReportAcknowledgementDialog';

type PersonnelReport = {
  id: string;
  division_id: string;
  reporter_name: string;
  reporter_personnel_id: string | null;
  guard_name: string;
  home_guard_code: string;
  division_name: string;
  category: string;
  description: string;
  event_name: string | null;
  event_date: string | null;
  status: string;
  created_at: string;
  evidence_photo: string | null;
  action_taken: string | null;
  acknowledged_at: string | null;
};

type GuardOption = { id: string; full_name: string; home_guard_code: string };
const categoryOptions = [
  { value: 'conduct', label: 'Conduct or behaviour' },
  { value: 'attendance', label: 'Attendance or duty' },
  { value: 'safety', label: 'Safety concern' },
  { value: 'other', label: 'Other' },
];

export function AdminPersonnelReports() {
  const { divisionId, resolved } = useDivision();
  const { role } = useAuth();
  const [reports, setReports] = useState<PersonnelReport[]>([]);
  const [guards, setGuards] = useState<GuardOption[]>([]);
  const [selectedGuardId, setSelectedGuardId] = useState('');
  const [guardSearch, setGuardSearch] = useState('');
  const [category, setCategory] = useState('conduct');
  const [description, setDescription] = useState('');
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [evidencePhoto, setEvidencePhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null);
  const [reportToDelete, setReportToDelete] = useState<PersonnelReport | null>(null);
  const [reportToAcknowledge, setReportToAcknowledge] = useState<PersonnelReport | null>(null);
  const [acknowledgingReport, setAcknowledgingReport] = useState(false);
  const [acknowledgementError, setAcknowledgementError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const selectedGuard = guards.find((guard) => guard.id === selectedGuardId);
  const matchingGuards = guards
    .filter((guard) => `${guard.full_name} ${guard.home_guard_code}`.toLowerCase().includes(guardSearch.trim().toLowerCase()))
    .slice(0, 8);

  const load = useCallback(async () => {
    if (!resolved) return;
    if (!divisionId) {
      setReports([]);
      setGuards([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    const supabase = createClient();
    const [reportResult, rosterResult] = await Promise.all([
      supabase
        .from('personnel_reports')
        .select('id,division_id,reporter_name,reporter_personnel_id,guard_name,home_guard_code,division_name,category,description,event_name,event_date,status,created_at,evidence_photo,action_taken,acknowledged_at')
        .eq('division_id', divisionId)
        .order('created_at', { ascending: false }),
      supabase
        .from('home_guard_roster')
        .select('id,full_name,home_guard_code')
        .eq('division_id', divisionId)
        .eq('is_active', true)
        .order('full_name'),
    ]);
    if (reportResult.error || rosterResult.error) {
      setError(reportResult.error?.message ?? rosterResult.error?.message ?? 'Could not load reports.');
    } else {
      setReports((reportResult.data ?? []) as PersonnelReport[]);
      setGuards((rosterResult.data ?? []) as GuardOption[]);
    }
    setLoading(false);
  }, [divisionId, resolved]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => setPortalReady(true), []);

  useEffect(() => {
    if (!showForm) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowForm(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [showForm]);

  useEffect(() => {
    if (!reportToDelete || deletingReportId) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setReportToDelete(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [reportToDelete, deletingReportId]);

  async function attachEvidence(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    try {
      setEvidencePhoto(await compressImage(file, 1200, 1200, 0.8));
    } catch {
      setError('Could not process that photo. Please choose another image.');
    }
  }

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!divisionId || !selectedGuard || !description.trim() || !eventName.trim() || !evidencePhoto) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await filePersonnelReport({
        guardId: selectedGuard.id,
        divisionId,
        category,
        description: description.trim(),
        evidencePhoto,
        eventName,
        eventDate,
      });
      setNotice(`Report filed for ${selectedGuard.full_name}.`);
      setSelectedGuardId('');
      setGuardSearch('');
      setCategory('conduct');
      setDescription('');
      setEventName('');
      setEventDate(new Date().toISOString().slice(0, 10));
      setEvidencePhoto(null);
      setShowForm(false);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not file the report. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteReport() {
    if (!reportToDelete || deletingReportId) return;
    const report = reportToDelete;
    setDeletingReportId(report.id);
    setError('');
    setNotice('');
    try {
      const { error: deleteError } = await createClient()
        .from('personnel_reports')
        .delete()
        .eq('id', report.id)
        .select('id')
        .single();
      if (deleteError) {
        window.alert(deleteError.message || 'Could not delete this report.');
      } else {
        setReports((current) => current.filter((item) => item.id !== report.id));
        window.alert(`Report for ${report.guard_name} deleted.`);
      }
    } catch (cause) {
      window.alert(cause instanceof Error ? cause.message : 'Could not delete this report.');
    } finally {
      setDeletingReportId(null);
      setReportToDelete(null);
    }
  }

  async function submitAcknowledgement(actionTaken: string) {
    if (!reportToAcknowledge || role !== 'admin') return;
    setAcknowledgingReport(true);
    setAcknowledgementError('');
    try {
      const { data, error: updateError } = await createClient()
        .from('personnel_reports')
        .update({ action_taken: actionTaken })
        .eq('id', reportToAcknowledge.id)
        .select('id,action_taken,acknowledged_at,status')
        .single();
      if (updateError) throw new Error(updateError.message);
      setReports((current) => current.map((report) => report.id === data.id
        ? { ...report, action_taken: data.action_taken, acknowledged_at: data.acknowledged_at, status: data.status }
        : report));
      setReportToAcknowledge(null);
      await load();
    } catch (cause) {
      setAcknowledgementError(cause instanceof Error ? cause.message : 'Could not acknowledge this report.');
    } finally {
      setAcknowledgingReport(false);
    }
  }

  return (
    <>
      <Card className="mt-5 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-outline-variant/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-headline-sm text-on-surface">Incharge and admin reports</h2>
            <p className="text-sm text-on-surface-variant">Reports filed about Home Guards in this division.</p>
          </div>
          <button
            type="button"
            aria-expanded={showForm}
            onClick={() => { setShowForm((current) => !current); setError(''); setNotice(''); }}
            disabled={!divisionId || loading || guards.length === 0}
            className="flex min-h-11 items-center justify-center gap-2 self-start rounded-lg bg-primary-container px-4 text-sm font-semibold text-on-primary transition-colors hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
          >
            <Icon icon={showForm ? 'close' : 'edit_document'} size={18} />
            {showForm ? 'Close form' : 'Submit report'}
          </button>
        </div>
        {error && !showForm && <p role="alert" className="p-4 text-sm text-on-error-container">{error}</p>}
        {notice && <p role="status" className="mx-4 mt-4 rounded-lg bg-tertiary-fixed p-3 text-sm text-on-tertiary-fixed-variant">{notice}</p>}
        {loading ? (
          <p className="flex items-center justify-center gap-2 p-8 text-sm text-on-surface-variant"><Icon icon="sync" size={18} className="animate-spin" />Loading reports…</p>
        ) : error && !showForm ? null : reports.length ? (
          <ul className="divide-y divide-outline-variant/60">
            {reports.map((report) => (
              <li key={report.id} className="space-y-2 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-on-surface">
                      <HomeGuardProfileLink code={report.home_guard_code} name={report.guard_name} className="text-left font-semibold text-on-surface hover:text-primary hover:underline">{report.guard_name}</HomeGuardProfileLink>{' '}
                      <span className="font-mono text-xs text-on-surface-variant">{report.home_guard_code}</span>
                    </p>
                    <p className="text-xs text-on-surface-variant">{report.division_name} · {new Date(report.created_at).toLocaleString('en-IN')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Chip tone={report.acknowledged_at || report.status === 'resolved' ? 'present' : 'live'}>{report.acknowledged_at ? 'Acknowledged' : report.status === 'under_review' ? 'Under review' : report.status}</Chip>
                    <button
                      type="button"
                      onClick={() => setReportToDelete(report)}
                      disabled={deletingReportId !== null}
                      aria-label={`Delete report for ${report.guard_name}`}
                      title="Delete report"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-error hover:bg-error-container disabled:cursor-wait disabled:opacity-50"
                    >
                      {deletingReportId === report.id ? <Icon icon="sync" size={18} className="animate-spin" /> : <Icon icon="delete" size={18} />}
                    </button>
                  </div>
                </div>
                <p className="text-xs font-semibold uppercase tracking-wide text-secondary">{categoryOptions.find((item) => item.value === report.category)?.label ?? 'Other'}</p>
                <p className="text-xs text-on-surface-variant">
                  Event:{' '}
                  {report.event_date ? (
                    <Link href={`/admin/events/${report.division_id}.${report.event_date}`} className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80">
                      {report.event_name || 'Event'}
                    </Link>
                  ) : (
                    <strong className="text-on-surface">{report.event_name || 'Not specified'}</strong>
                  )}
                  {report.event_date && ` · ${new Date(`${report.event_date}T00:00:00`).toLocaleDateString('en-IN')}`}
                </p>
                <p className="whitespace-pre-wrap text-sm text-on-surface">{report.description}</p>
                {report.evidence_photo && <EvidencePhotoPreview src={report.evidence_photo} alt={`Memo photo for report on ${report.guard_name}`} />}
                <p className="text-xs text-on-surface-variant">Filed by {report.reporter_name}{report.reporter_personnel_id ? ` · ${report.reporter_personnel_id}` : ''}</p>
                {report.acknowledged_at ? (
                  <div className="rounded-lg bg-surface-container-low p-3 text-sm">
                    <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">Action taken</p>
                    <p className="mt-1 whitespace-pre-wrap text-on-surface">{report.action_taken}</p>
                  </div>
                ) : role === 'admin' ? (
                  <button
                    type="button"
                    onClick={() => { setReportToAcknowledge(report); setAcknowledgementError(''); }}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-3.5 text-sm font-bold text-on-primary hover:bg-primary/90"
                  >
                    <Icon icon="task_alt" size={18} />
                    Acknowledge
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : !error ? (
          <EmptyState icon="inbox" title="No reports in this division" body="Use Submit report to file a report about a Home Guard." />
        ) : null}
      </Card>

      {portalReady && showForm && createPortal(
        <div className="overlay-enter fixed inset-0 z-[90] flex items-center justify-center bg-primary/35 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowForm(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="admin-submit-report-title" className="overlay-panel max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-4 shadow-2xl sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 id="admin-submit-report-title" className="text-headline-sm text-on-surface">Submit a report</h2>
                <p className="text-sm text-on-surface-variant">Choose a Home Guard from the selected division and describe the concern.</p>
              </div>
              <button type="button" onClick={() => setShowForm(false)} aria-label="Close report form" className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container">
                <Icon icon="close" size={20} />
              </button>
            </div>
          <form onSubmit={(event) => void submitReport(event)} className="space-y-4">
            <div className="text-label-md text-on-surface">
              <label htmlFor="admin-report-guard-search">Home Guard</label>
              <div className="relative mt-1.5">
                <Icon icon="search" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                <input
                  id="admin-report-guard-search"
                  type="search"
                  autoComplete="off"
                  value={selectedGuard ? `${selectedGuard.full_name} · ${selectedGuard.home_guard_code}` : guardSearch}
                  onChange={(event) => { setSelectedGuardId(''); setGuardSearch(event.target.value); }}
                  placeholder="Search by name or Home Guard code"
                  className="h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest pl-10 pr-3 text-sm"
                  aria-controls="admin-report-guard-results"
                />
              </div>
              {selectedGuard ? (
                <div className="mt-2 flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
                  <span>{selectedGuard.full_name} <span className="text-on-surface-variant">· {selectedGuard.home_guard_code}</span></span>
                  <button type="button" onClick={() => { setSelectedGuardId(''); setGuardSearch(''); }} className="rounded-md px-2 py-1 text-primary hover:bg-primary/10">Change</button>
                </div>
              ) : guardSearch.trim() ? (
                <div id="admin-report-guard-results" className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-outline-variant bg-surface-container-lowest shadow-sm">
                  {matchingGuards.length ? matchingGuards.map((guard) => (
                    <button key={guard.id} type="button" onClick={() => { setSelectedGuardId(guard.id); setGuardSearch(''); }} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-surface-container">
                      <span className="font-medium text-on-surface">{guard.full_name}</span>
                      <span className="shrink-0 text-xs text-on-surface-variant">{guard.home_guard_code}</span>
                    </button>
                  )) : <p className="px-3 py-3 text-sm text-on-surface-variant">No Home Guards match that name or code.</p>}
                </div>
              ) : <p className="mt-1 text-xs text-on-surface-variant">Search by name or Home Guard code.</p>}
              {!guards.length && <p className="mt-1 text-xs text-on-surface-variant">No active Home Guards are available in this division.</p>}
            </div>
            <label className="block text-label-md text-on-surface">
              Report category
              <select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm">
                {categoryOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label className="block text-label-md text-on-surface">
              What happened?
              <textarea required maxLength={4000} rows={5} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the incident and the relevant duty or date when known." className="mt-1.5 w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary" />
            </label>
            <EventNameAutocomplete
              divisionId={divisionId}
              value={eventName}
              onChange={setEventName}
              onSelect={(event) => setEventDate(event.event_date)}
              inputClassName="mt-1.5 h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface"
            />
            <label className="block text-label-md text-on-surface">
              Event date
              <input required type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface" />
            </label>
            <div>
              <span className="mb-1.5 block text-label-md text-on-surface">Memo photo <span className="text-error">(required)</span></span>
              {evidencePhoto ? (
                <div className="flex items-center gap-3 rounded-lg bg-surface-container-low p-2">
                  <Image src={evidencePhoto} alt="Report memo preview" width={80} height={56} unoptimized className="h-14 w-20 rounded-md object-cover" />
                  <button type="button" onClick={() => setEvidencePhoto(null)} className="text-xs font-bold text-error underline">Remove photo</button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-outline-variant bg-surface-container-low px-3 text-label-md font-semibold text-primary hover:bg-surface-container">
                    <Icon icon="photo_camera" size={18} />Take memo photo
                    <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => void attachEvidence(event)} />
                  </label>
                  <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-outline-variant bg-surface-container-low px-3 text-label-md font-semibold text-primary hover:bg-surface-container">
                    <Icon icon="add_photo_alternate" size={18} />Choose from gallery
                    <input type="file" accept="image/*" className="sr-only" onChange={(event) => void attachEvidence(event)} />
                  </label>
                </div>
              )}
            </div>
            {error && <p role="alert" className="rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">{error}</p>}
            <div className="flex justify-end border-t border-outline-variant pt-3">
              <button type="submit" disabled={saving || !selectedGuardId || !description.trim() || !eventName.trim() || !eventDate || !evidencePhoto} className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary-container px-5 text-sm font-semibold text-on-primary disabled:opacity-50">
                {saving ? <Icon icon="sync" size={18} className="animate-spin" /> : <Icon icon="send" size={18} />}
                {saving ? 'Submitting…' : 'Submit report'}
              </button>
            </div>
          </form>
          </section>
        </div>,
        document.body,
      )}

      {portalReady && reportToDelete && createPortal(
        <div
          className="overlay-enter fixed inset-0 z-[110] flex items-center justify-center bg-primary/40 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deletingReportId) setReportToDelete(null);
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-personnel-report-title"
            aria-describedby="delete-personnel-report-description"
            className="overlay-panel w-full max-w-md rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-error-container text-on-error-container">
                <Icon icon="delete" size={22} />
              </span>
              <div className="min-w-0 pt-0.5">
                <h2 id="delete-personnel-report-title" className="text-headline-sm text-on-surface">Delete report?</h2>
                <p id="delete-personnel-report-description" className="mt-1 text-sm leading-6 text-on-surface-variant">
                  Delete the report filed for {reportToDelete.guard_name}? This cannot be undone.
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setReportToDelete(null)}
                disabled={Boolean(deletingReportId)}
                className="min-h-11 rounded-lg border border-outline-variant px-4 text-sm font-semibold text-on-surface hover:bg-surface-container disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteReport()}
                disabled={Boolean(deletingReportId)}
                className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-error px-4 text-sm font-semibold text-white hover:bg-error/90 disabled:opacity-60"
              >
                {deletingReportId ? <Icon icon="sync" size={18} className="animate-spin" /> : <Icon icon="delete" size={18} />}
                {deletingReportId ? 'Deleting report…' : 'Delete report'}
              </button>
            </div>
          </section>
        </div>,
        document.body,
      )}

      <ReportAcknowledgementDialog
        open={Boolean(reportToAcknowledge)}
        guardName={reportToAcknowledge?.guard_name ?? ''}
        submitting={acknowledgingReport}
        error={acknowledgementError}
        onCancel={() => setReportToAcknowledge(null)}
        onSubmit={submitAcknowledgement}
      />
    </>
  );
}
