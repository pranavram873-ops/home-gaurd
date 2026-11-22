'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '@/lib/auth/authContext';
import { useDivision } from '@/lib/attendance/divisionContext';
import { useLiveQuery } from '@/lib/hooks/useLiveQuery';
import { createClient } from '@/lib/supabase/client';
import { getAdminDivisionDashboard, type AdminDivisionDashboard } from '@/lib/services/statsService';
import { ReportAcknowledgementDialog } from '@/components/reports/ReportAcknowledgementDialog';

function formatActivityTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

function getReportChange(current: number, previous: number) {
  if (previous === 0) {
    return current === 0
      ? { icon: 'remove', label: '0% no change', tone: 'text-on-surface-variant' }
      : { icon: 'arrow_upward', label: 'New this month', tone: 'text-tertiary' };
  }

  const percent = Math.round(((current - previous) / previous) * 100);
  if (percent === 0) {
    return { icon: 'remove', label: '0% no change', tone: 'text-on-surface-variant' };
  }
  if (percent > 0) {
    return { icon: 'arrow_upward', label: `${percent}% more`, tone: 'text-tertiary' };
  }
  return { icon: 'arrow_downward', label: `${Math.abs(percent)}% less`, tone: 'text-error' };
}

const reportOverviewPeriods = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
] as const;

export default function AdminDashboardPage() {
  const { user, role } = useAuth();
  const { divisionId, resolved: divisionResolved } = useDivision();
  const [overviewPeriod, setOverviewPeriod] = useState<'weekly' | 'monthly'>('weekly');
  const [reportToAcknowledge, setReportToAcknowledge] = useState<AdminDivisionDashboard['recentReports'][number] | null>(null);
  const [acknowledging, setAcknowledging] = useState(false);
  const [acknowledgementError, setAcknowledgementError] = useState('');
  const [showAllReports, setShowAllReports] = useState(false);
  const [allReports, setAllReports] = useState<AdminDivisionDashboard['recentReports']>([]);
  const [allReportsLoading, setAllReportsLoading] = useState(false);
  const [allReportsError, setAllReportsError] = useState('');
  const hasOpenReportDialog = showAllReports || Boolean(reportToAcknowledge);
  const statsQuery = useLiveQuery<AdminDivisionDashboard>(
    () => divisionResolved
      ? getAdminDivisionDashboard(divisionId)
      : Promise.resolve({ data: null, error: null }),
    `${divisionResolved}:${divisionId}`,
  );
  useEffect(() => {
    if (!hasOpenReportDialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [hasOpenReportDialog]);
  const stats = statsQuery.data;
  const divisionStats = stats?.selectedDivision?.id === divisionId ? stats : (divisionId ? null : stats?.selectedDivision ? null : stats);
  const reportOverview = divisionStats?.reportOverview[overviewPeriod] ?? [];
  const reportOverviewMax = Math.max(1, ...reportOverview.map((bucket) => bucket.count));
  const firstName = user?.full_name?.trim().split(/\s+/)[0] || 'Administrator';
  const shortcuts = [
    { label: 'Open events', value: divisionStats?.openEvents, href: '/admin/events', icon: 'event_note', tone: 'bg-primary-container text-on-primary-container' },
    { label: 'Total guards', value: divisionStats?.totalGuards, href: '/admin/personnel', icon: 'groups', tone: 'bg-secondary-container text-on-secondary-container' },
  ];

  async function openAllReports() {
    setShowAllReports(true);
    setAllReportsLoading(true);
    setAllReportsError('');
    try {
      const supabase = createClient();
      const pageSize = 100;
      const reports: AdminDivisionDashboard['recentReports'] = [];
      for (let offset = 0; ; offset += pageSize) {
        let query = supabase
          .from('personnel_reports')
          .select('id, division_id, division_name, guard_name, home_guard_code, category, description, event_name, event_date, status, created_at, action_taken, acknowledged_at')
          .order('created_at', { ascending: false });
        if (divisionId) query = query.eq('division_id', divisionId);
        const { data, error } = await query.range(offset, offset + pageSize - 1);
        if (error) throw new Error(error.message);
        const page = (data ?? []).map((report) => ({
          id: report.id,
          divisionId: report.division_id,
          divisionName: report.division_name,
          guardName: report.guard_name,
          homeGuardCode: report.home_guard_code,
          category: report.category,
          description: report.description,
          eventName: report.event_name,
          eventDate: report.event_date,
          status: report.status,
          createdAt: report.created_at,
          actionTaken: report.action_taken,
          acknowledgedAt: report.acknowledged_at,
        }));
        reports.push(...page);
        if (page.length < pageSize) break;
      }
      setAllReports(reports);
    } catch (reason) {
      setAllReportsError(reason instanceof Error ? reason.message : 'Could not load reports.');
    } finally {
      setAllReportsLoading(false);
    }
  }

  async function submitAcknowledgement(actionTaken: string) {
    if (!reportToAcknowledge || !actionTaken.trim()) return;
    setAcknowledging(true);
    setAcknowledgementError('');
    try {
      const { data, error } = await createClient()
        .from('personnel_reports')
        .update({ action_taken: actionTaken })
        .eq('id', reportToAcknowledge.id)
        .select('id, action_taken, acknowledged_at, status')
        .single();
      if (error) throw new Error(error.message);
      setAllReports((current) => current.map((report) => report.id === data.id
        ? { ...report, actionTaken: data.action_taken, acknowledgedAt: data.acknowledged_at, status: data.status }
        : report));
      setReportToAcknowledge(null);
      await statsQuery.refresh();
    } catch (reason) {
      setAcknowledgementError(reason instanceof Error ? reason.message : 'Could not acknowledge this report.');
    } finally {
      setAcknowledging(false);
    }
  }

  return (
    <DashboardLayout title="Dashboard" subtitle={divisionStats?.selectedDivision ? `${divisionStats.selectedDivision.name} Division` : 'Division overview'}>
      <div className="mx-auto flex max-w-6xl flex-col gap-5 sm:gap-6">
        <section className="flex flex-col gap-4 rounded-2xl bg-primary p-5 text-on-primary shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight sm:text-[1.75rem]">Welcome, {firstName}</h1>
            <p className="mt-1 text-sm text-on-primary/80 sm:text-base">
              {divisionStats?.selectedDivision ? `${divisionStats.selectedDivision.name} Division · Operations at a glance` : 'Choose a division to view its operations.'}
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
            <Link
              href={divisionStats?.selectedDivision ? '/admin/events' : '/admin/divisions'}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-surface-container-lowest px-4 text-sm font-bold text-primary transition-colors hover:bg-primary-fixed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-surface-container-lowest"
            >
              {divisionStats?.selectedDivision ? 'Manage events' : 'Choose a division'}
              <Icon icon="arrow_forward" size={18} />
            </Link>
          </div>
        </section>

        {statsQuery.error && (
          <div role="alert" className="flex items-start gap-3 rounded-xl border border-error-container bg-error-container p-4 text-sm text-on-error-container">
            <Icon icon="error" size={20} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-bold">Dashboard data could not be loaded</p>
              <p className="mt-0.5">{statsQuery.error}</p>
            </div>
            <button type="button" onClick={() => void statsQuery.refresh()} disabled={statsQuery.loading} className="min-h-10 shrink-0 rounded-lg px-3 font-bold underline underline-offset-2 disabled:opacity-60">
              Try again
            </button>
          </div>
        )}

        <section aria-label="Division operational summary" className="grid grid-cols-2 gap-3 sm:gap-4">
          {shortcuts.map((shortcut) => (
            <Link
              key={shortcut.label}
              href={shortcut.href}
              aria-label={`${shortcut.label}: ${statsQuery.loading ? 'loading' : shortcut.value ?? 'unavailable'}. Open ${shortcut.label.toLowerCase()}.`}
              className="group flex min-h-28 items-center gap-3 rounded-2xl border border-outline-variant/70 bg-surface-container-lowest p-3 shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary-container hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:min-h-32 sm:gap-4 sm:p-4"
            >
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full sm:h-12 sm:w-12 ${shortcut.tone}`}>
                <Icon icon={shortcut.icon} size={23} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-2xl font-bold leading-none tabular-nums text-on-surface sm:text-[1.75rem]">
                  {statsQuery.loading ? '—' : shortcut.value ?? '—'}
                </span>
                <span className="mt-1.5 block text-xs font-medium leading-snug text-on-surface-variant sm:text-sm">{shortcut.label}</span>
              </span>
              <Icon icon="chevron_right" size={20} className="shrink-0 text-outline transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </Link>
          ))}
        </section>

        <section className="overflow-hidden rounded-2xl border border-outline-variant/70 bg-surface-container-lowest shadow-xs">
          <div className="flex items-center justify-between gap-3 border-b border-outline-variant/60 px-4 py-4 sm:px-5">
            <div className="flex min-w-0 items-center gap-2.5">
              <Icon icon="bar_chart" size={22} className="shrink-0 text-primary" />
              <div className="min-w-0">
                <h2 className="text-base font-bold text-on-surface sm:text-lg">Reports Overview</h2>
                <p className="text-xs text-on-surface-variant">Reports submitted during the selected period.</p>
              </div>
            </div>
            <Link href="/admin/reports" className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-lg px-2 text-sm font-bold text-primary hover:bg-surface-container">
              View all
              <Icon icon="arrow_forward" size={17} />
            </Link>
          </div>
          <div role="tablist" aria-label="Report overview period" className="mx-4 mt-4 grid grid-cols-2 rounded-xl bg-surface-container-low p-1 sm:mx-5">
            {reportOverviewPeriods.map((period) => (
              <button
                key={period.value}
                type="button"
                role="tab"
                aria-selected={overviewPeriod === period.value}
                aria-controls="report-overview-chart"
                onClick={() => setOverviewPeriod(period.value)}
                className={`min-h-10 rounded-lg px-2 text-sm font-bold transition-colors ${overviewPeriod === period.value ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
              >
                {period.label}
              </button>
            ))}
          </div>
          {statsQuery.loading ? (
            <p role="status" className="px-5 py-10 text-center text-sm text-on-surface-variant">Loading report overview…</p>
          ) : statsQuery.error && !stats ? (
            <p className="px-5 py-10 text-center text-sm text-on-surface-variant">Report overview is unavailable.</p>
          ) : reportOverview.length ? (
            <div id="report-overview-chart" role="tabpanel" aria-label={`${overviewPeriod} report counts`} className="px-4 pb-4 pt-3 sm:px-5">
              <div className="overflow-x-auto pb-2">
                <ol className="flex h-40 min-w-full items-end gap-2 border-b border-outline-variant/60">
                  {reportOverview.map((bucket) => (
                    <li
                      key={`${overviewPeriod}-${bucket.label}`}
                      aria-label={`${bucket.count} reports at ${bucket.label}`}
                      title={`${bucket.count} reports · ${bucket.label}`}
                      className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
                    >
                      <span className="h-4 text-[10px] font-semibold leading-4 tabular-nums text-on-surface-variant">
                        {bucket.count}
                      </span>
                      <div className="flex h-24 w-full items-end justify-center">
                        <span
                          aria-hidden="true"
                          className="w-full max-w-12 rounded-t bg-primary/80 transition-[height] duration-300"
                          style={{ height: `${bucket.count ? Math.max(5, (bucket.count / reportOverviewMax) * 100) : 2}%` }}
                        />
                      </div>
                      <span className="h-4 text-[10px] leading-4 text-on-surface-variant sm:text-xs">
                        {bucket.label}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
              {!reportOverview.some((bucket) => bucket.count > 0) && (
                <p className="mt-2 text-center text-xs text-on-surface-variant">No reports in this period yet.</p>
              )}
            </div>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-on-surface-variant">No report data available.</p>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border border-outline-variant/70 bg-surface-container-lowest shadow-xs">
          <div className="border-b border-outline-variant/60 px-4 py-4 sm:px-5">
            <div className="flex min-w-0 items-center gap-2.5">
              <Icon icon="location_on" size={21} className="shrink-0 text-primary" />
              <div className="min-w-0">
                <h2 className="text-base font-bold text-on-surface sm:text-lg">Division-wise report</h2>
                <p className="text-xs text-on-surface-variant">This month compared with the previous month.</p>
              </div>
            </div>
          </div>
          {divisionStats?.divisionReportComparison.length ? (
            <ul className="grid grid-cols-2 divide-x divide-y divide-outline-variant/50 sm:grid-cols-4">
              {divisionStats.divisionReportComparison.map((division) => {
                const change = getReportChange(division.currentMonth, division.previousMonth);
                return (
                  <li key={division.divisionId} className="min-w-0 px-4 py-4 sm:px-5">
                    <p className="truncate text-sm font-semibold text-on-surface">{division.divisionName}</p>
                    <p className="mt-1 text-2xl font-bold leading-none tabular-nums text-on-surface">{division.currentMonth}</p>
                    <p className="mt-1 text-xs text-on-surface-variant">reports this month</p>
                    <p
                      className={`mt-2 inline-flex items-center gap-1 text-xs font-bold ${change.tone}`}
                      aria-label={`${change.label} compared with ${division.previousMonth} reports last month`}
                      title={`${division.currentMonth} this month; ${division.previousMonth} last month`}
                    >
                      <Icon icon={change.icon} size={15} />
                      {change.label}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-5 py-8 text-center text-sm text-on-surface-variant">Division report counts are unavailable.</p>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border border-outline-variant/70 bg-surface-container-lowest shadow-xs">
          <div className="flex items-center justify-between gap-3 border-b border-outline-variant/60 px-4 py-4 sm:px-5">
            <div className="flex min-w-0 items-center gap-2.5">
              <Icon icon="description" size={21} className="shrink-0 text-primary" />
              <div className="min-w-0">
                <h2 className="text-base font-bold text-on-surface sm:text-lg">Created reports</h2>
                <p className="text-xs text-on-surface-variant">Acknowledge each report and record the action taken.</p>
              </div>
            </div>
            <button type="button" onClick={() => void openAllReports()} disabled={allReportsLoading} className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-lg px-2 text-sm font-bold text-primary hover:bg-surface-container disabled:opacity-60">
              View more
              <Icon icon="arrow_forward" size={17} />
            </button>
          </div>
          {statsQuery.loading ? (
            <p role="status" className="px-5 py-8 text-center text-sm text-on-surface-variant">Loading reports…</p>
          ) : statsQuery.error && !stats ? (
            <p className="px-5 py-8 text-center text-sm text-on-surface-variant">Reports are unavailable. Try loading the dashboard again.</p>
          ) : divisionStats?.recentReports.length ? (
            <ul className="divide-y divide-outline-variant/50">
              {divisionStats.recentReports.slice(0, 2).map((report) => (
                <li key={report.id} className="space-y-3 px-4 py-4 sm:px-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-on-surface">{report.guardName} <span className="font-mono text-xs font-medium text-on-surface-variant">{report.homeGuardCode}</span></p>
                      <p className="mt-0.5 text-xs text-on-surface-variant">{report.divisionName} · {report.category.replaceAll('_', ' ')} · {formatActivityTime(report.createdAt)}</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-on-surface">{report.description}</p>
                      {(report.eventName || report.eventDate) && <p className="mt-1 text-xs text-on-surface-variant">{report.eventName ?? 'Event'}{report.eventDate ? ` · ${report.eventDate}` : ''}</p>}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${report.acknowledgedAt ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-secondary-container text-on-secondary-container'}`}>
                        {report.acknowledgedAt ? 'Acknowledged' : report.status.replaceAll('_', ' ')}
                      </span>
                      {!report.acknowledgedAt && role === 'admin' && (
                        <button
                          type="button"
                          onClick={() => { setReportToAcknowledge(report); setAcknowledgementError(''); }}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-2.5 text-xs font-bold text-on-primary hover:bg-primary/90"
                        >
                          <Icon icon="task_alt" size={16} />
                          Acknowledge
                        </button>
                      )}
                    </div>
                  </div>
                  {report.acknowledgedAt && (
                    <div className="rounded-lg bg-surface-container-low p-3 text-sm">
                      <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">Action taken</p>
                      <p className="mt-1 whitespace-pre-wrap text-on-surface">{report.actionTaken}</p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-5 py-10 text-center">
              <Icon icon="description" size={28} className="text-outline" />
              <p className="mt-2 text-sm font-semibold text-on-surface">No reports filed</p>
              <p className="mt-1 text-xs text-on-surface-variant">Reports created for this division will appear here.</p>
            </div>
          )}
        </section>

        {showAllReports && typeof document !== 'undefined' && createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-center justify-center overflow-hidden bg-surface-container/60 p-3 backdrop-blur-xs sm:p-4"
            role="presentation"
            onMouseDown={(event) => { if (event.target === event.currentTarget) setShowAllReports(false); }}
          >
            <section role="dialog" aria-modal="true" aria-labelledby="all-reports-title" className="h-[88dvh] max-h-[48rem] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-2xl">
              <header className="flex shrink-0 items-center justify-between gap-3 border-b border-outline-variant/60 p-4 sm:px-5">
                <div>
                  <h2 id="all-reports-title" className="text-lg font-bold text-on-surface">All reports</h2>
                  <p className="text-xs text-on-surface-variant">{divisionStats?.selectedDivision?.name ?? 'All divisions'}</p>
                </div>
                <button type="button" onClick={() => setShowAllReports(false)} aria-label="Close all reports" className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container">
                  <Icon icon="close" size={20} />
                </button>
              </header>
              {allReportsLoading ? (
                <p role="status" className="p-8 text-center text-sm text-on-surface-variant">Loading reports…</p>
              ) : allReportsError ? (
                <div className="p-5">
                  <p role="alert" className="rounded-lg bg-error-container p-3 text-sm text-on-error-container">{allReportsError}</p>
                  <button type="button" onClick={() => void openAllReports()} className="mt-3 text-sm font-bold text-primary underline">Try again</button>
                </div>
              ) : allReports.length ? (
                <ul className="divide-y divide-outline-variant/50">
                    {allReports.map((report) => (
                      <li key={report.id} className="space-y-3 p-4 sm:px-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-on-surface">{report.guardName} <span className="font-mono text-xs font-medium text-on-surface-variant">{report.homeGuardCode}</span></p>
                            <p className="mt-0.5 text-xs text-on-surface-variant">{report.divisionName} · {report.category.replaceAll('_', ' ')} · {formatActivityTime(report.createdAt)}</p>
                            <p className="mt-2 whitespace-pre-wrap text-sm text-on-surface">{report.description}</p>
                            {(report.eventName || report.eventDate) && <p className="mt-1 text-xs text-on-surface-variant">{report.eventName ?? 'Event'}{report.eventDate ? ` · ${report.eventDate}` : ''}</p>}
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-2">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${report.acknowledgedAt ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-secondary-container text-on-secondary-container'}`}>
                              {report.acknowledgedAt ? 'Acknowledged' : report.status.replaceAll('_', ' ')}
                            </span>
                            {!report.acknowledgedAt && role === 'admin' && (
                              <button
                                type="button"
                                onClick={() => { setReportToAcknowledge(report); setAcknowledgementError(''); }}
                                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-2.5 text-xs font-bold text-on-primary hover:bg-primary/90"
                              >
                                <Icon icon="task_alt" size={16} />
                                Acknowledge
                              </button>
                            )}
                          </div>
                        </div>
                        {report.acknowledgedAt && (
                          <div className="rounded-lg bg-surface-container-low p-3 text-sm">
                            <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">Action taken</p>
                            <p className="mt-1 whitespace-pre-wrap text-on-surface">{report.actionTaken}</p>
                          </div>
                        )}
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="p-8 text-center text-sm text-on-surface-variant">No reports filed.</p>
              )}
            </section>
          </div>,
          document.body,
        )}

      </div>

      <ReportAcknowledgementDialog
        open={Boolean(reportToAcknowledge)}
        guardName={reportToAcknowledge?.guardName ?? ''}
        submitting={acknowledging}
        error={acknowledgementError}
        onCancel={() => setReportToAcknowledge(null)}
        onSubmit={submitAcknowledgement}
      />
    </DashboardLayout>
  );
}
