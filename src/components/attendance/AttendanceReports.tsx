'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Chip, EmptyState } from '@/components/ui/primitives';
import { createClient } from '@/lib/supabase/client';

type ReportStatus = 'submitted' | 'under_review' | 'resolved' | 'dismissed';

interface GuardReport {
  id: string;
  reporter_name: string;
  reporter_personnel_id: string | null;
  subject_name: string;
  subject_personnel_id: string | null;
  category: string;
  description: string;
  status: ReportStatus;
  resolution_note: string | null;
  created_at: string;
}

const reportColumns =
  'id,reporter_name,reporter_personnel_id,subject_name,subject_personnel_id,category,description,status,resolution_note,created_at';

const categoryLabels: Record<string, string> = {
  conduct: 'Conduct or Professionalism',
  attendance: 'Attendance Regularity',
  safety: 'Safety Concern',
  other: 'Other Concern',
};

const statusMeta: Record<ReportStatus, { label: string; tone: 'live' | 'present' | 'inverse'; icon: string }> = {
  submitted: { label: 'Report Filed', tone: 'live', icon: 'draft' },
  under_review: { label: 'Under Review', tone: 'live', icon: 'pending' },
  resolved: { label: 'Report Closed', tone: 'present', icon: 'check_circle' },
  dismissed: { label: 'Closed', tone: 'inverse', icon: 'do_not_disturb_on' },
};

function formatDateTime(iso: string) {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function DossierCard({ report, historyCount }: { report: GuardReport; historyCount: number }) {
  const [open, setOpen] = useState(false);
  const status = statusMeta[report.status] ?? statusMeta.submitted;
  return (
    <article className="relative flex flex-col gap-3 overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-card">
      <span className="absolute inset-x-0 top-0 h-1.5 bg-secondary-container" aria-hidden />

      <div className="flex items-start justify-between gap-2 pt-1">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-headline-sm tracking-tight text-primary">{report.subject_name}</h3>
            {report.subject_personnel_id && (
              <span className="shrink-0 rounded bg-surface-container px-1.5 py-0.5 font-mono text-label-sm text-on-surface-variant">
                {report.subject_personnel_id}
              </span>
            )}
          </div>
          <span className="mt-0.5 block text-body-md text-sm text-on-surface-variant">
            Filed {formatDateTime(report.created_at)}
          </span>
        </div>
        <Chip tone={status.tone} icon={status.icon}>{status.label}</Chip>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-high px-2.5 py-1 text-label-sm text-on-surface">
          <Icon icon="assignment" size={14} className="text-secondary" />
          Written Memo • {categoryLabels[report.category] ?? 'Other Concern'}
        </span>
      </div>

      {historyCount > 0 && (
        <div className="flex items-start gap-2.5 rounded-lg bg-surface-container-low p-2.5">
          <Icon icon="warning" size={20} className="mt-0.5 shrink-0 text-secondary-container" />
          <div className="flex min-w-0 flex-col">
            <span className="text-label-md text-on-surface">
              {historyCount === 1 ? '1 report on file for this guard' : `${historyCount} reports on file for this guard`}
            </span>
            <span className="text-label-sm text-on-surface-variant">
              Cumulative administrative log. Neutral record — not a charge or suspension.
            </span>
          </div>
        </div>
      )}

      <div className="rounded-lg bg-surface-container/60 p-3">
        <span className="block text-[13px] uppercase tracking-wider text-on-surface-variant">Filing Incharge</span>
        <div className="mt-0.5 flex items-center gap-1 text-label-md text-on-surface">
          <Icon icon="edit_note" size={15} className="text-primary" />
          <span className="truncate">{report.reporter_name || 'Unknown'}</span>
          {report.reporter_personnel_id && (
            <span className="font-mono text-[13px] text-on-surface-variant">({report.reporter_personnel_id})</span>
          )}
        </div>
        <span className="mt-2 block text-[13px] uppercase tracking-wider text-on-surface-variant">
          Officer Field Observation
        </span>
        <p className="mt-0.5 whitespace-pre-wrap rounded bg-surface-container-lowest p-2 text-body-md text-sm leading-relaxed text-on-surface">
          {report.description}
        </p>
      </div>

      {open && (
        <div className="rounded-lg bg-surface-container-low p-3">
          <span className="block text-[13px] uppercase tracking-wider text-on-surface-variant">Command Response</span>
          {report.resolution_note ? (
            <p className="mt-1 whitespace-pre-wrap text-body-md text-sm text-on-tertiary-container">{report.resolution_note}</p>
          ) : (
            <p className="mt-1 text-label-md text-on-surface-variant">No command response recorded yet.</p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex items-center justify-between rounded bg-surface-container-high px-3 py-2.5 text-label-md text-primary transition-colors hover:bg-surface-container"
      >
        <span className="flex items-center gap-1.5">
          <Icon icon="history_toggle_off" size={18} className="text-on-surface-variant" />
          {open ? 'Hide case details' : 'Open report & history'}
        </span>
        <Icon icon={open ? 'expand_less' : 'chevron_right'} size={18} />
      </button>
    </article>
  );
}

export function AttendanceReports() {
  const [reports, setReports] = useState<GuardReport[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const supabase = createClient();
      const { data, error: queryError } = await supabase
        .from('guard_reports')
        .select(reportColumns)
        .order('created_at', { ascending: false });
      if (queryError) {
        setError(queryError.message);
        setReports([]);
      } else {
        setReports((data ?? []) as GuardReport[]);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load disciplinary records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const historyByGuard = useMemo(() => {
    const bySubject = new Map<string, number>();
    for (const report of reports) {
      if (!report.subject_name) continue;
      const key = report.subject_personnel_id ?? report.subject_name;
      bySubject.set(key, (bySubject.get(key) ?? 0) + 1);
    }
    return bySubject;
  }, [reports]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return reports;
    return reports.filter((report) =>
      `${report.subject_name} ${report.subject_personnel_id ?? ''} ${report.reporter_name ?? ''}`.toLowerCase().includes(term),
    );
  }, [reports, search]);

  return (
    <div className="mx-auto max-w-2xl space-y-0">
      {/* Contextual sub-bar / district scope. */}
      <section className="rounded-b-xl bg-primary-container px-4 py-3 text-on-primary">
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 flex-col">
            <span className="text-headline-md tracking-tight text-surface-container-lowest">Reports</span>
            <span className="mt-0.5 flex items-center gap-1.5 text-label-sm uppercase tracking-wider text-primary-fixed">
              <Icon icon="shield" size={15} className="text-secondary-container" />
              Command &amp; Disciplinary Overview
            </span>
          </div>
          <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded bg-primary px-2.5 text-label-sm text-on-primary-fixed">
            <span className="h-2 w-2 animate-pulse rounded-full bg-secondary-container" aria-hidden />
            LIVE LOGS
          </span>
        </div>
      </section>

      {/* Search deck. */}
      <section className="rounded-lg bg-surface-container-low px-4 py-3 shadow-sm">
        <div className="relative flex items-center">
          <Icon icon="search" size={20} className="pointer-events-none absolute left-3 text-on-surface-variant" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search guard name, HG code, or incharge..."
            aria-label="Search disciplinary reports"
            className="h-11 w-full rounded bg-surface-container-lowest pl-10 pr-3 text-body-md text-on-surface shadow-sm ring-primary/20 placeholder:text-outline focus:outline-none focus:ring-2"
          />
        </div>
      </section>

      {/* Section title + meta. */}
      <div className="flex items-center justify-between px-1 pt-4 pb-1">
        <div className="flex items-center gap-2">
          <span className="text-label-lg text-primary">Disciplinary Dossiers</span>
          <span className="rounded-full bg-surface-container-highest px-2 py-0.5 text-label-sm text-on-surface">
            {loading ? '…' : `${visible.length} visible`}
          </span>
        </div>
      </div>

      <section className="flex flex-col gap-4 py-1">
        {error ? (
          <div role="alert" className="flex items-start gap-2.5 rounded-lg bg-error-container p-3 text-on-error-container">
            <Icon icon="error" size={20} fill className="mt-0.5 shrink-0 text-error" />
            <div className="min-w-0 flex-1 text-sm">
              <p>{error}</p>
              <button type="button" onClick={load} className="mt-1 font-bold underline">Try again</button>
            </div>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-on-surface-variant">
            <Icon icon="sync" size={20} className="animate-spin" />
            Loading disciplinary records…
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon="inbox"
            title="No disciplinary reports"
            body={search ? 'No dossiers match that search.' : 'Reports filed by incharges will appear here.'}
          />
        ) : (
          visible.map((report) => (
            <DossierCard
              key={report.id}
              report={report}
              historyCount={(report.subject_personnel_id ?? report.subject_name)
                ? Math.max(0, (historyByGuard.get(report.subject_personnel_id ?? report.subject_name) ?? 1) - 1)
                : 0}
            />
          ))
        )}

        <div className="flex items-center justify-center gap-2 py-3 text-center text-on-surface-variant/80">
          <Icon icon="gavel" size={16} className="text-secondary" />
          <span className="text-label-sm">Official record under Tamil Nadu Home Guard Act • For Incharge Reference Only</span>
        </div>
      </section>
    </div>
  );
}
