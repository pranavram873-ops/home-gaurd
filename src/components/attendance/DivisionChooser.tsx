'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '@/lib/auth/authContext';
import { useDivision } from '@/lib/attendance/divisionContext';
import { loadDivisionSummaries, type DivisionSummary } from '@/lib/services/simpleAttendanceService';

const DISTRICT_NAMES: Record<string, string> = {
  AVN: 'Avinashi',
  DHP: 'Dharapuram',
  KGM: 'Kangeyam',
  PLM: 'Palladam',
  UDP: 'Udumalaipettai',
};

function getShortDistrictCode(division: DivisionSummary) {
  if (division.code) return division.code.toUpperCase().slice(0, 3);
  const fallback = DISTRICT_NAMES[division.name?.toUpperCase().slice(0, 3)] ?? division.name ?? 'D';
  return fallback.slice(0, 3).toUpperCase();
}

function todayLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function DivisionCard({
  division,
  selected,
  onSelect,
}: {
  division: DivisionSummary;
  selected: boolean;
  onSelect: (id: string, target: HTMLButtonElement) => void;
}) {
  const districtName = DISTRICT_NAMES[division.code] ?? division.name;
  const districtCode = division.code || getShortDistrictCode(division);

  return (
    <button
      type="button"
      onClick={(event) => onSelect(division.id, event.currentTarget)}
      aria-pressed={selected}
      className={`group relative flex aspect-square w-full flex-col items-center border-0 bg-transparent p-0 text-center shadow-none transition-all duration-200 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:aspect-auto md:min-h-[176px] md:w-full md:flex-col md:items-stretch md:justify-between md:rounded-2xl md:border md:border-primary-container md:bg-primary-container md:p-5 md:text-left md:transition-all md:duration-200 md:hover:-translate-y-0.5 md:hover:bg-primary md:hover:shadow-card xl:min-h-[196px] xl:p-6 ${selected ? 'md:border-secondary md:bg-primary md:ring-2 md:ring-secondary/50 md:shadow-card' : 'md:shadow-md'}`}
    >
      <span className={`relative flex h-full w-full items-center justify-center rounded-[28px] bg-primary-container text-[clamp(4.5rem,19vw,7rem)] font-semibold text-on-primary-container shadow-card transition-all duration-300 group-hover:bg-primary md:hidden ${selected ? 'ring-[3px] ring-primary ring-offset-[5px]' : ''}`}>
        {districtName.charAt(0).toUpperCase()}
        {selected && <span className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-lowest text-secondary shadow-sm"><Icon icon="check" size={22} fill /></span>}
      </span>
      <span className="mt-3 max-w-full truncate px-1 text-lg font-bold text-on-surface transition-colors group-hover:text-primary-container md:hidden">{districtName}</span>

      <span className="hidden md:flex md:w-full md:flex-col md:gap-8">
        <span className="flex items-start justify-between gap-4">
          <span className={`flex h-12 min-w-12 items-center justify-center rounded-xl px-3 text-sm font-bold tracking-[0.12em] transition-colors ${selected ? 'bg-surface-container-lowest text-primary' : 'bg-white/15 text-on-primary group-hover:bg-white/25'}`}>
            {districtCode.slice(0, 3)}
          </span>
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all ${selected ? 'bg-surface-container-lowest text-primary' : 'border border-white/40 text-transparent group-hover:border-white'}`}>
            <Icon icon="check" size={15} />
          </span>
        </span>
        <span className="flex items-end justify-between gap-3">
          <span className="min-w-0">
            <span className="block truncate text-2xl font-semibold leading-tight text-on-primary xl:text-[1.7rem]">{districtName}</span>
            <span className="mt-2 block text-sm font-medium text-on-primary/75">Open division</span>
          </span>
          <Icon icon="arrow_forward" size={21} className="mb-0.5 shrink-0 text-on-primary/80 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-on-primary" />
        </span>
      </span>
    </button>
  );
}

export function DivisionChooser() {
  const router = useRouter();
  const { role } = useAuth();
  const { divisionId, setDivisionId, resolved } = useDivision();
  const [selectedId, setSelectedId] = useState(divisionId);
  const [divisions, setDivisions] = useState<DivisionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [enteringDivision, setEnteringDivision] = useState<DivisionSummary | null>(null);
  const [transitionOrigin, setTransitionOrigin] = useState({ x: '50vw', y: '50vh' });

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    loadDivisionSummaries(todayLocal())
      .then(setDivisions)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not load divisions.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!resolved) return;
    load();
  }, [resolved, load]);

  useEffect(() => setSelectedId(divisionId), [divisionId]);

  function select(id: string, target: HTMLButtonElement) {
    if (enteringDivision) return;
    setSelectedId(id);
    const division = divisions.find((item) => item.id === id);
    if (!division) return;
    const bounds = target.getBoundingClientRect();
    setTransitionOrigin({ x: `${bounds.left + bounds.width / 2}px`, y: `${bounds.top + bounds.height / 2}px` });
    setDivisionId(id);
    setEnteringDivision(division);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(() => {
      router.push(role === 'admin' ? '/admin/dashboard' : '/incharge/attendance');
    }, reduceMotion ? 0 : 580);
  }

  return (
    <div className="mx-auto min-h-[calc(100vh-3rem)] w-full max-w-[720px] space-y-5 sm:space-y-6 md:max-w-5xl md:space-y-8 lg:max-w-6xl">
      <div className="px-1 py-1 text-center md:flex md:items-end md:justify-between md:text-left">
        <div>
          <h1 className="text-[2rem] font-bold leading-tight tracking-tight text-on-surface md:text-3xl">Choose a division</h1>
          <p className="mt-2 text-sm text-on-surface-variant md:text-base">Select where you want to work.</p>
        </div>
        <span className="hidden rounded-full bg-surface-container-low px-3 py-1.5 text-sm font-medium text-on-surface-variant md:inline-flex md:items-center md:gap-2">
          <Icon icon="domain" size={17} className="text-primary-container" />
          {divisions.length} divisions
        </span>
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
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-outline-variant bg-surface-container-lowest p-10 text-sm text-on-surface-variant shadow-card md:p-14">
          <Icon icon="sync" size={20} className="animate-spin" />
          Loading districts…
        </div>
      ) : divisions.length === 0 ? (
        <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-10 text-center shadow-card md:p-14">
          <Icon icon="domain" size={32} className="mx-auto text-outline" />
          <h4 className="mt-3 text-xl font-bold text-on-surface">No districts configured</h4>
          <p className="mt-1 text-sm text-on-surface-variant">Ask Command HQ to set up the attendance districts.</p>
        </div>
      ) : (
        <div role="list" className="stagger-in grid grid-cols-2 gap-x-3 gap-y-5 md:grid-cols-2 md:gap-5 lg:grid-cols-3 xl:gap-6">
          {divisions.map((division) => (
            <div key={division.id}>
              <DivisionCard division={division} selected={division.id === selectedId} onSelect={select} />
            </div>
          ))}
        </div>
      )}

      {/* Polished division entry expand & workspace reveal transition */}
      {enteringDivision && (
        <div
          className="division-entry fixed inset-0 z-[100] flex items-center justify-center bg-primary text-on-primary"
          style={{ '--division-origin-x': transitionOrigin.x, '--division-origin-y': transitionOrigin.y } as React.CSSProperties}
          role="status"
          aria-live="polite"
        >
          <div className="division-entry-content flex flex-col items-center px-6 text-center">
            <span className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary-container text-3xl font-bold text-on-primary">
              {(DISTRICT_NAMES[enteringDivision.code] ?? enteringDivision.name).charAt(0)}
            </span>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{DISTRICT_NAMES[enteringDivision.code] ?? enteringDivision.name}</h2>
            <div className="mt-4 flex items-center gap-2.5 text-sm text-on-primary/80">
              <Icon icon="sync" size={17} className="animate-spin" />
              <span>Opening division workspace</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
