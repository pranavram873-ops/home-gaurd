'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { Card, EmptyState, SegmentedFilter } from '@/components/ui/primitives';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  loadAttendancePage,
  parseAttendanceEventId,
  type DailyMark,
  type RosterGuard,
} from '@/lib/services/simpleAttendanceService';

function formatDay(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return date;
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(iso: string) {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase();
}

type Filter = 'all' | 'present' | 'absent';

function GuardRow({ guard, mark }: { guard: RosterGuard; mark?: DailyMark }) {
  const present = mark?.status === 'present';
  const absent = mark?.status === 'absent';
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-3.5 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
              absent ? 'bg-error-container text-on-error-container' : 'bg-primary-fixed text-on-primary-fixed'
            }`}
          >
            {initials(guard.full_name)}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h4 className="truncate text-[16px] font-semibold text-primary">{guard.full_name}</h4>
              <span className="shrink-0 rounded bg-surface-container px-1.5 py-0.5 font-mono text-[13px] text-on-surface">{guard.home_guard_code}</span>
            </div>
            <span className="text-label-sm text-on-surface-variant">{guard.phone}</span>
          </div>
        </div>
        {present ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-tertiary-fixed px-2 py-0.5 text-label-sm font-bold text-on-tertiary-fixed">
            <Icon icon="check" size={13} fill />
            {mark ? formatTime(mark.marked_at) : 'Present'}
          </span>
        ) : absent ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-error-container px-2 py-0.5 text-label-sm font-bold text-on-error-container">
            <Icon icon="close" size={13} />
            Absent
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center rounded-full bg-surface-container px-2 py-0.5 text-label-sm font-bold uppercase text-on-surface-variant">
            Not marked
          </span>
        )}
      </div>
    </li>
  );
}

export default function AdminEventDetailsPage() {
  const params = useParams<{ id: string }>();
  const rawId = Array.isArray(params?.id) ? params.id[0] : params?.id ?? '';
  const parsed = parseAttendanceEventId(rawId);

  const [roster, setRoster] = useState<RosterGuard[]>([]);
  const [marks, setMarks] = useState<DailyMark[]>([]);
  const [divisionName, setDivisionName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!parsed) {
      setLoading(false);
      setError('This muster record link is not valid.');
      return;
    }
    let live = true;
    setLoading(true);
    setError('');
    loadAttendancePage(parsed.divisionId, parsed.date)
      .then((data) => {
        if (!live) return;
        setRoster(data.roster);
        setMarks(data.marks);
        setDivisionName(data.divisions.find((division) => division.id === parsed.divisionId)?.name ?? 'Division');
      })
      .catch((reason: unknown) => live && setError(reason instanceof Error ? reason.message : 'Could not load this record.'))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [parsed]);

  const markByGuard = useMemo(() => new Map(marks.map((mark) => [mark.guard_id, mark])), [marks]);
  const presentCount = marks.filter((mark) => mark.status === 'present').length;
  const absentCount = marks.filter((mark) => mark.status === 'absent').length;
  const sanctionedCount = roster.length;
  const presentPct = sanctionedCount ? Math.round((presentCount / sanctionedCount) * 100) : 0;
  const absentPct = sanctionedCount ? Math.round((absentCount / sanctionedCount) * 100) : 0;
  const isOpen = parsed ? parsed.date >= todayISO() : false;

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return roster.filter((guard) => {
      const status = markByGuard.get(guard.id)?.status;
      const matchesFilter = filter === 'all' || status === filter;
      const matchesSearch = !term || `${guard.full_name} ${guard.home_guard_code}`.toLowerCase().includes(term);
      return matchesFilter && matchesSearch;
    });
  }, [roster, filter, search, markByGuard]);

  return (
    <DashboardLayout title="Muster Record" subtitle="Admin event details">
      <div className="mx-auto max-w-2xl pb-10">
      {/* Return bar */}
      <div className="flex items-center justify-between rounded bg-surface-container-low px-4 py-2 shadow-sm">
        <Link href="/admin/dashboard" className="flex items-center gap-1 text-label-md text-primary active:opacity-75">
          <Icon icon="arrow_back" size={18} />
          Events
        </Link>
        <div className="flex items-center gap-1.5 rounded-full bg-surface-container px-2 py-1">
          <Icon icon="fingerprint" size={14} className="text-on-surface-variant" />
          <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">{parsed ? formatDay(parsed.date) : '—'}</span>
        </div>
      </div>

      {error ? (
        <div role="alert" className="mt-4 flex items-start gap-2.5 rounded-lg bg-error-container p-3 text-on-error-container">
          <Icon icon="error" size={20} fill className="mt-0.5 shrink-0 text-error" />
          <span className="min-w-0 flex-1 text-sm">{error}</span>
        </div>
      ) : (
        <>
          {/* Header */}
          <section className="px-1 pt-4">
            <div className="mb-1 flex items-start justify-between gap-2">
              <h2 className="text-headline-md leading-snug tracking-tight text-primary">
                {divisionName || 'Muster'} {parsed ? formatDay(parsed.date) : ''}
              </h2>
              <span
                className={`inline-flex shrink-0 items-center gap-1 rounded px-2.5 py-1 text-label-sm font-bold tracking-wide ${
                  isOpen ? 'bg-secondary-fixed text-on-secondary-fixed-variant' : 'bg-surface-container-highest text-on-surface'
                }`}
              >
                <span className={`inline-block h-2 w-2 rounded-full ${isOpen ? 'bg-secondary' : 'bg-error'}`} aria-hidden />
                {isOpen ? 'MUSTER OPEN' : 'MUSTER CLOSED'}
              </span>
            </div>
            <div className="flex flex-col gap-1 text-label-md text-on-surface-variant">
              <div className="flex items-center gap-1.5">
                <Icon icon="domain" size={16} className="text-primary" />
                <span>{divisionName} Division</span>
              </div>
              {parsed && (
                <div className="flex items-center gap-1.5">
                  <Icon icon="schedule" size={16} className="text-secondary" />
                  <span>{formatDay(parsed.date)}</span>
                </div>
              )}
            </div>
          </section>

          {/* Metrics */}
          <section className="px-1 py-2">
            <div className="grid grid-cols-3 gap-1">
              <Card className="flex flex-col justify-between p-3">
                <div className="mb-1 flex items-center justify-between text-on-tertiary-container">
                  <span className="text-label-sm font-bold uppercase">Present</span>
                  <Icon icon="check_circle" size={18} fill />
                </div>
                <div>
                  <span className="text-headline-lg tracking-tight text-primary">{loading ? '—' : presentCount}</span>
                  <p className="mt-0.5 text-label-sm font-semibold text-on-tertiary-container">{presentPct}%</p>
                </div>
              </Card>
              <Card className="flex flex-col justify-between p-3">
                <div className="mb-1 flex items-center justify-between text-error">
                  <span className="text-label-sm font-bold uppercase">Absent</span>
                  <Icon icon="cancel" size={18} fill />
                </div>
                <div>
                  <span className="text-headline-lg tracking-tight text-error">{loading ? '—' : absentCount}</span>
                  <p className="mt-0.5 text-label-sm font-semibold text-error">{absentPct}%</p>
                </div>
              </Card>
              <Card className="flex flex-col justify-between p-3">
                <div className="mb-1 flex items-center justify-between text-on-surface-variant">
                  <span className="text-label-sm font-bold uppercase">Sanctioned</span>
                  <Icon icon="groups" size={18} />
                </div>
                <div>
                  <span className="text-headline-lg tracking-tight text-primary">{loading ? '—' : sanctionedCount}</span>
                  <p className="mt-0.5 text-label-sm font-medium text-on-surface-variant">Guards</p>
                </div>
              </Card>
            </div>
            <Card className="mt-2 p-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">Parade Quorum Ratio</span>
                <span className="text-label-sm font-bold text-primary">{presentCount} / {sanctionedCount} Deployed</span>
              </div>
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-error-container">
                <span className="h-full bg-tertiary-fixed-dim" style={{ width: `${presentPct}%` }} />
              </div>
            </Card>
          </section>

          {/* Roster */}
          <section className="px-1 py-2">
            <div className="mb-1 flex items-baseline justify-between">
              <h3 className="text-headline-sm text-primary">Rostered Personnel</h3>
              <span className="text-label-sm font-bold uppercase text-on-surface-variant">Total {sanctionedCount}</span>
            </div>
            <SegmentedFilter<Filter>
              label="Filter by status"
              value={filter}
              onChange={setFilter}
              className="mb-3 bg-surface-container-high"
              options={[
                { value: 'all', label: 'All', count: sanctionedCount },
                { value: 'present', label: 'Present', count: presentCount },
                { value: 'absent', label: 'Absent', count: absentCount },
              ]}
            />
            <div className="relative mb-3">
              <Icon icon="search" size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                type="search"
                aria-label="Search guard name or HG code"
                placeholder="Search guard name or HG code..."
                className="w-full rounded-xl bg-surface-container-lowest py-2.5 pl-10 pr-3 text-body-md text-on-surface shadow-sm ring-primary/20 placeholder:text-outline focus:outline-none focus:ring-2"
              />
            </div>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-on-surface-variant">
                <Icon icon="sync" size={20} className="animate-spin" />
                Loading record…
              </div>
            ) : visible.length === 0 ? (
              <EmptyState icon="person_search" title="No personnel found" body="Check your spelling or reset the filter above." />
            ) : (
              <ul className="flex flex-col gap-2.5">
                {visible.map((guard) => (
                  <GuardRow key={guard.id} guard={guard} mark={markByGuard.get(guard.id)} />
                ))}
              </ul>
            )}
          </section>

          {/* Official footer seal */}
          <footer className="px-1 pt-2">
            <div className="flex items-start gap-2.5 rounded-xl bg-surface-container-low p-3.5">
              <Icon icon="verified" size={20} className="mt-0.5 shrink-0 text-primary" />
              <div className="flex flex-col gap-0.5">
                <span className="text-label-sm font-bold uppercase tracking-wide text-primary">Official Command Record</span>
                <p className="text-[13px] leading-relaxed text-on-surface-variant">
                  Tamil Nadu Police Act • Tamper-proof muster logged with Tiruppur District HG Headquarters.
                </p>
              </div>
            </div>
          </footer>
        </>
      )}
    </div>
    </DashboardLayout>
  );
}

function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
