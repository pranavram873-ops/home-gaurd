'use client';

import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '@/lib/auth/authContext';
import { useDivision } from '@/lib/attendance/divisionContext';
import { useLiveQuery } from '@/lib/hooks/useLiveQuery';
import { getAdminDivisionDashboard, type AdminDivisionDashboard } from '@/lib/services/statsService';

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

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const { divisionId, resolved: divisionResolved } = useDivision();
  const statsQuery = useLiveQuery<AdminDivisionDashboard>(
    () => divisionResolved
      ? getAdminDivisionDashboard(divisionId)
      : Promise.resolve({ data: null, error: null }),
    `${divisionResolved}:${divisionId}`,
  );
  const stats = statsQuery.data;
  const divisionStats = stats?.selectedDivision?.id === divisionId ? stats : (divisionId ? null : stats?.selectedDivision ? null : stats);
  const firstName = user?.full_name?.trim().split(/\s+/)[0] || 'Administrator';
  const shortcuts = [
    { label: 'Open events', value: divisionStats?.openEvents, href: '/admin/events', icon: 'event_note', tone: 'bg-primary-container text-on-primary-container' },
    { label: 'Total guards', value: divisionStats?.totalGuards, href: '/admin/personnel', icon: 'groups', tone: 'bg-secondary-container text-on-secondary-container' },
    { label: 'Present today', value: divisionStats?.presentToday, href: '/admin/events', icon: 'check_circle', tone: 'bg-tertiary-container text-on-tertiary-container' },
    { label: 'Absent today', value: divisionStats?.absentToday, href: '/admin/events', icon: 'cancel', tone: 'bg-error-container text-on-error-container' },
  ];

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

        <section aria-label="Division operational summary" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
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
          <div className="flex items-center gap-2.5 border-b border-outline-variant/60 px-4 py-4 sm:px-5">
            <Icon icon="history" size={21} className="text-primary" />
            <h2 className="text-base font-bold text-on-surface sm:text-lg">Recent activity</h2>
          </div>

          {statsQuery.loading ? (
            <div role="status" aria-label="Loading recent activity" className="divide-y divide-outline-variant/50">
              {[0, 1, 2].map((item) => (
                <div key={item} className="flex items-center gap-3 px-4 py-4 sm:px-5">
                  <span className="h-10 w-10 animate-pulse rounded-full bg-surface-container-high" />
                  <span className="flex-1 space-y-2">
                    <span className="block h-3 w-36 animate-pulse rounded bg-surface-container-high" />
                    <span className="block h-3 w-52 max-w-full animate-pulse rounded bg-surface-container" />
                  </span>
                </div>
              ))}
            </div>
          ) : statsQuery.error && !stats ? (
            <p className="px-5 py-8 text-center text-sm text-on-surface-variant">Activity is unavailable. Try loading the dashboard again.</p>
          ) : !divisionStats?.selectedDivision ? (
            <div className="flex flex-col items-center px-5 py-10 text-center">
              <Icon icon="domain" size={28} className="text-outline" />
              <p className="mt-2 text-sm font-semibold text-on-surface">Select a division</p>
              <p className="mt-1 text-xs text-on-surface-variant">The summary and activity will update to match your selection.</p>
            </div>
          ) : divisionStats.recentActivity.length ? (
            <ul className="divide-y divide-outline-variant/50">
              {divisionStats.recentActivity.map((activity) => {
                const content = (
                  <>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
                      <Icon icon={activity.icon} size={20} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-on-surface">{activity.title}</span>
                      <span className="mt-0.5 block truncate text-xs text-on-surface-variant sm:text-sm">{activity.description}</span>
                    </span>
                    <time dateTime={activity.occurredAt} className="shrink-0 text-right text-xs text-on-surface-variant">
                      {formatActivityTime(activity.occurredAt)}
                    </time>
                    {activity.href && <Icon icon="arrow_forward" size={18} className="shrink-0 text-primary" />}
                  </>
                );
                return (
                  <li key={activity.id}>
                    {activity.href ? (
                      <Link href={activity.href} className="group flex min-h-16 items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:px-5">
                        {content}
                      </Link>
                    ) : (
                      <div className="flex min-h-16 items-center gap-3 px-4 py-3.5 sm:px-5">{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex flex-col items-center px-5 py-10 text-center">
              <Icon icon="history" size={28} className="text-outline" />
              <p className="mt-2 text-sm font-semibold text-on-surface">No recent activity</p>
              <p className="mt-1 text-xs text-on-surface-variant">Attendance and personnel reports for this division will appear here.</p>
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
