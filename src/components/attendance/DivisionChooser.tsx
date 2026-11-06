'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '@/lib/auth/authContext';
import { useDivision } from '@/lib/attendance/divisionContext';
import { loadDivisionSummaries, type DivisionSummary } from '@/lib/services/simpleAttendanceService';

// Presentation strings for the five Tiruppur sub-divisions seeded by
// 20261024000001. Cards fall back to the database name when a code is new.
const TAMIL_NAMES: Record<string, string> = {
  AVN: 'அவிநாசி',
  DHP: 'தாராபுரம்',
  KGM: 'காங்கேயம்',
  PLM: 'பல்லடம்',
  UDP: 'உடுமலைப்பேட்டை',
};

function todayLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function DivisionCard({ division, onSelect }: { division: DivisionSummary; onSelect: (id: string) => void }) {
  const marked = division.presentCount + division.absentCount;
  // A division without a roster cannot be "up to date"; it needs guards first.
  const upToDate = division.guardCount > 0 && marked >= division.guardCount;

  return (
    <button
      type="button"
      onClick={() => onSelect(division.id)}
      className="group relative flex w-full flex-col gap-2.5 overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4 text-left shadow-card transition-transform duration-100 active:scale-[0.99]"
    >
      {/* Accent strip flags the division whose muster is still open. */}
      {!upToDate && <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-secondary" />}
      <div className="flex items-start justify-between gap-2 pl-1">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-container-high text-primary-container">
            <Icon icon="domain" size={22} />
          </span>
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-headline-sm text-on-surface">{division.name}</span>
              <span className="truncate text-label-md font-normal text-on-surface-variant">
                {TAMIL_NAMES[division.code] ?? division.code}
              </span>
            </div>
            <span className="text-label-sm text-on-surface-variant">{division.guardCount} Home Guards</span>
          </div>
        </div>
        {upToDate ? (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-surface-container-highest px-2.5 py-1 font-medium text-label-sm text-on-surface-variant">
            <Icon icon="check_circle" size={14} fill className="text-on-tertiary-container" />
            Up to date
          </span>
        ) : (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-secondary-fixed px-2.5 py-1 font-bold text-label-sm text-on-secondary-fixed-variant">
            <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-secondary" />
            {division.guardCount ? 'Muster open' : 'Roster empty'}
          </span>
        )}
      </div>
      {division.bandobast ? (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-surface-container-low px-3 py-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <Icon icon="campaign" size={16} className="shrink-0 text-secondary" />
            <span className="truncate text-label-sm text-on-surface-variant">
              Active Bandobast: <span className="font-semibold text-on-surface">{division.bandobast.title}</span>
            </span>
          </div>
          <span className="flex shrink-0 items-center gap-1 font-bold text-label-md text-secondary">
            Open
            <Icon icon="arrow_forward" size={16} />
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-surface-container-low px-3 py-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <Icon icon="local_police" size={16} className="shrink-0 text-surface-tint" />
            <span className="truncate text-label-sm text-on-surface-variant">No Bandobast recorded for today</span>
          </div>
          <Icon icon="chevron_right" size={20} className="shrink-0 text-outline transition-transform group-active:translate-x-0.5" />
        </div>
      )}
    </button>
  );
}

export function DivisionChooser() {
  const router = useRouter();
  const { user } = useAuth();
  const { divisionId, setDivisionId, resolved } = useDivision();
  const [divisions, setDivisions] = useState<DivisionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    loadDivisionSummaries(todayLocal())
      .then(setDivisions)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not load divisions.'))
      .finally(() => setLoading(false));
  }, []);

  // With a division already stored this screen is a pass-through: returning to
  // Attendance lands on that division's muster instead of re-asking. It only
  // lists the choices while none exists (a fresh login after sign-out, or the
  // first time an incharge opens the workspace).
  useEffect(() => {
    if (!resolved) return;
    if (divisionId) {
      router.replace('/incharge/attendance');
      return;
    }
    load();
  }, [resolved, divisionId, router, load]);

  function select(id: string) {
    setDivisionId(id);
    router.push('/incharge/attendance');
  }

  const totalGuards = divisions.reduce((sum, division) => sum + division.guardCount, 0);

  return (
    <div className="mx-auto max-w-[640px] space-y-4">
      {/* The greeting banner is this screen's header, so the page skips the
          command bar chrome entirely. */}
      <section className="rounded-b-xl bg-primary-container px-1 pb-5 pt-4 text-on-primary shadow-sm">
        <div className="flex items-center gap-1.5 self-start rounded-full bg-primary/40 px-2.5 py-1">
          <Icon icon="shield" size={16} fill className="text-secondary-container" />
          <span className="text-label-sm uppercase tracking-wider text-secondary-container">TN Home Guards • Tiruppur</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-label-sm font-medium tracking-wide text-primary-fixed-dim">வணக்கம் / Welcome</p>
            <h1 className="mt-0.5 text-headline-sm text-on-primary">
              Incharge {user?.full_name || '—'}
            </h1>
            {user?.personnel_id && (
              <p className="mt-1 text-label-sm text-outline-variant">ID: {user.personnel_id} • District HQ Command</p>
            )}
          </div>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-secondary-fixed shadow-inner">
            <Icon icon="badge" size={26} />
          </span>
        </div>
      </section>

      <div>
        <div className="mb-1 flex items-center gap-2">
          <span aria-hidden className="h-4 w-1.5 rounded-full bg-secondary-container" />
          <h2 className="text-headline-md text-on-surface">Which division do you want to view?</h2>
        </div>
        <p className="text-body-md text-on-surface-variant">
          Select a division to take new duty attendance or inspect roster muster records.
        </p>
      </div>

      <div className="flex items-center justify-between rounded-lg bg-surface-container-low px-3.5 py-2.5 shadow-sm">
        <div className="flex items-center gap-2">
          <Icon icon="domain" size={18} className="text-surface-tint" />
          <span className="font-semibold text-label-md text-on-surface">
            {loading ? 'Loading divisions…' : `${divisions.length} Active Sub-Divisions`}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-on-surface-variant">
          <Icon icon="groups" size={16} fill className="text-tertiary-fixed-dim" />
          <span className="font-bold text-label-md text-on-surface">{totalGuards} Total Personnel</span>
        </div>
      </div>

      {error ? (
        <div className="flex items-start gap-2.5 rounded-lg bg-error-container p-3 text-on-error-container" role="alert">
          <Icon icon="error" size={20} fill className="mt-0.5 shrink-0 text-error" />
          <div className="min-w-0 flex-1 text-sm">
            <p>{error}</p>
            <button type="button" onClick={load} className="mt-1 font-bold underline">
              Try again
            </button>
          </div>
        </div>
      ) : !resolved || loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-10 text-sm text-on-surface-variant shadow-card">
          <Icon icon="sync" size={20} className="animate-spin" />
          Loading divisions…
        </div>
      ) : divisions.length === 0 ? (
        <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-10 text-center shadow-card">
          <Icon icon="domain" size={32} className="mx-auto text-outline" />
          <h4 className="mt-3 text-headline-sm text-on-surface">No divisions configured</h4>
          <p className="mt-1 text-body-md text-sm text-on-surface-variant">Ask Command HQ to set up the attendance divisions.</p>
        </div>
      ) : (
        <div role="list" className="flex flex-col gap-3">
          {divisions.map((division) => (
            <DivisionCard key={division.id} division={division} onSelect={select} />
          ))}
        </div>
      )}
    </div>
  );
}
