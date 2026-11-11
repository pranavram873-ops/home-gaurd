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

const TAMIL_NAMES: Record<string, string> = {
  AVN: 'அவிநாசி',
  DHP: 'தாராபுரம்',
  KGM: 'காங்கேயம்',
  PLM: 'பல்லடம்',
  UDP: 'உடுமலைப்பேட்டை',
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
  const marked = division.presentCount + division.absentCount;
  const upToDate = division.guardCount > 0 && marked >= division.guardCount;
  const districtName = DISTRICT_NAMES[division.code] ?? division.name;
  const districtCode = division.code || getShortDistrictCode(division);
  const badge = upToDate ? 'Updated' : division.guardCount ? 'Pending' : 'No roster';

  return (
    <button
      type="button"
      onClick={(event) => onSelect(division.id, event.currentTarget)}
      aria-pressed={selected}
      className={`group relative flex w-full flex-col items-center overflow-visible rounded-[28px] border-0 bg-transparent p-0 text-center shadow-none transition-all duration-300 active:scale-[0.98] md:items-stretch md:gap-3 md:overflow-hidden md:border md:bg-white md:p-3.5 md:text-left md:shadow-[0_18px_40px_rgba(17,38,67,0.08)] md:hover:-translate-y-1 md:hover:shadow-[0_26px_50px_rgba(17,38,67,0.13)] ${selected ? 'md:border-[#24598a] md:ring-2 md:ring-[#24598a] md:ring-offset-2' : ''}`}
    >
      <div className={`relative flex aspect-square w-full items-center justify-center rounded-[28px] bg-[#3977a7] text-[clamp(4.5rem,19vw,7rem)] font-semibold text-white shadow-[0_12px_24px_rgba(32,77,116,0.16)] transition-all duration-300 group-hover:scale-[1.02] ${selected ? 'ring-[3px] ring-[#24598a] ring-offset-[5px]' : ''} md:hidden`}>
        {districtName.charAt(0).toUpperCase()}
        {selected && (
          <span className="animate-check-pop absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#9d3440] shadow-md">
            <Icon icon="check" size={22} fill />
          </span>
        )}
      </div>
      <span className="mt-3 max-w-full truncate px-1 text-lg font-bold text-[#18334f] transition-colors duration-200 group-hover:text-primary md:hidden">{districtName}</span>

      <div className="hidden w-full flex-col gap-3 md:flex">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#102a43] to-[#24598a] text-xl font-bold text-white shadow-inner shadow-black/10 transition-transform duration-300 group-hover:scale-105">
              {districtCode.slice(0, 2)}
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6b7d8d]">District</p>
              <h3 className="mt-1 truncate text-xl font-bold text-[#102a43] transition-colors duration-200 group-hover:text-[#24598a]">{districtName}</h3>
              <p className="text-sm text-[#526372]">{TAMIL_NAMES[division.code] ?? districtCode}</p>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] transition-all duration-200 ${selected ? 'animate-check-pop bg-[#e7f0ff] text-[#24598a]' : upToDate ? 'bg-[#eaf7f2] text-[#1d7a5a]' : 'bg-[#fff2e8] text-[#b76114]'}`}>
            {selected && <Icon icon="check_circle" size={14} fill />}
            {selected ? 'Selected' : badge}
          </span>
        </div>

        <div className="rounded-2xl bg-[#f3f7fb] p-3 transition-colors duration-200 group-hover:bg-[#ebf2f8]">
          <div className="flex items-center justify-between gap-2 text-sm text-[#526372]">
            <span>{division.guardCount} Home Guards</span>
            <span className="font-semibold text-[#102a43]">{marked}/{division.guardCount || 0} marked</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#dfe9f3]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#2d7ec6] to-[#1f9d6f] transition-all duration-700 ease-out"
              style={{ width: `${division.guardCount ? (marked / division.guardCount) * 100 : 0}%` }}
            />
          </div>
        </div>

        {division.bandobast ? (
          <div className="flex items-center justify-between gap-2 rounded-2xl bg-[#fff7ea] px-3 py-2 text-left">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9a5a13]">Bandobast</p>
              <p className="truncate text-sm font-semibold text-[#2b2f36]">{division.bandobast.title}</p>
            </div>
            <span className="text-sm font-bold text-[#9a5a13]">Open</span>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 rounded-2xl bg-[#f4f7fa] px-3 py-2 text-[#526372]">
            <span className="text-sm">No duty assigned today</span>
            <Icon icon="arrow_forward" size={18} className="text-[#102a43]" />
          </div>
        )}
      </div>
    </button>
  );
}

export function DivisionChooser() {
  const router = useRouter();
  const { user, role } = useAuth();
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

  const totalGuards = divisions.reduce((sum, division) => sum + division.guardCount, 0);
  return (
    <div className="mx-auto max-w-[720px] space-y-4">
      <section className="hidden rounded-[32px] bg-gradient-to-br from-[#102a43] via-[#183d63] to-[#24598a] px-4 pb-5 pt-4 text-white shadow-[0_18px_40px_rgba(18,40,63,0.18)] sm:px-5 md:block">
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-sky-100">
            <Icon icon="shield" size={14} fill className="text-[#dfeeff]" />
            TN Home Guards • Tiruppur
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-lg text-sky-100">
            <Icon icon="badge" size={22} />
          </div>
        </div>

        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-100/80">வணக்கம் / Welcome</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-[2rem]">{role === 'admin' ? 'Administrator' : 'Incharge'} {user?.full_name || '—'}</h1>
          </div>
          <div className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-sky-100/90">
            {user?.personnel_id ? `ID ${user.personnel_id}` : 'District HQ'}
          </div>
        </div>
      </section>

      <div className="border-0 bg-transparent px-1 py-1 text-center md:rounded-[28px] md:border md:border-[#e8edf3] md:bg-white/90 md:px-4 md:py-4 md:text-left md:shadow-[0_12px_32px_rgba(16,42,67,0.05)] md:backdrop-blur-sm">
        <div className="flex items-center justify-center gap-2.5 md:justify-start">
          <span className="hidden h-2.5 w-2.5 rounded-full bg-[#cc5641] md:block" aria-hidden />
          <h2 className="text-[2rem] font-bold leading-tight tracking-tight text-[#18334f] md:text-xl md:text-[#102a43] lg:text-[1.65rem]">Select your division</h2>
        </div>
        <p className="mt-2 text-base text-[#6b7280] md:text-sm md:text-[#526372] lg:text-base">
          Choose a division to review muster records
        </p>
      </div>

      <div className="hidden rounded-[22px] border border-[#e6edf4] bg-[#f7fafc] px-3 py-2.5 shadow-[0_10px_20px_rgba(17,38,67,0.04)] md:block">
        <div className="flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2 text-[#102a43]">
            <Icon icon="domain" size={18} className="text-[#24598a]" />
            <span className="font-semibold">
              {loading ? 'Loading districts…' : `${divisions.length} available districts`}
            </span>
          </div>
          <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#526372]">
            {totalGuards} guards
          </span>
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
        <div className="flex items-center justify-center gap-2 rounded-[28px] border border-[#e6edf4] bg-white p-10 text-sm text-[#526372] shadow-[0_12px_26px_rgba(16,42,67,0.06)]">
          <Icon icon="sync" size={20} className="animate-spin" />
          Loading districts…
        </div>
      ) : divisions.length === 0 ? (
        <div className="rounded-[28px] border border-[#e6edf4] bg-white p-10 text-center shadow-[0_12px_26px_rgba(16,42,67,0.06)]">
          <Icon icon="domain" size={32} className="mx-auto text-[#728797]" />
          <h4 className="mt-3 text-xl font-bold text-[#102a43]">No districts configured</h4>
          <p className="mt-1 text-sm text-[#526372]">Ask Command HQ to set up the attendance districts.</p>
        </div>
      ) : (
        <div role="list" className="stagger-in grid grid-cols-2 gap-x-3 gap-y-5 md:gap-4">
          {divisions.map((division) => (
            <div key={division.id}>
              <DivisionCard division={division} selected={division.id === selectedId} onSelect={select} />
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-center gap-2 py-5 text-center text-[#667085] md:hidden">
        <Icon icon="verified_user" size={18} className="text-[#9d3440]" />
        <span className="text-sm">Authorized for Official Review • TN Police Dept</span>
      </div>

      {/* Polished division entry expand & workspace reveal transition */}
      {enteringDivision && (
        <div
          className="division-entry fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-br from-[#102a43] via-[#183d63] to-[#24598a] text-white"
          style={{ '--division-origin-x': transitionOrigin.x, '--division-origin-y': transitionOrigin.y } as React.CSSProperties}
          role="status"
          aria-live="polite"
        >
          <div className="division-entry-content flex flex-col items-center px-6 text-center">
            <span className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-white text-3xl font-bold text-[#102a43]">
              {(DISTRICT_NAMES[enteringDivision.code] ?? enteringDivision.name).charAt(0)}
            </span>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{DISTRICT_NAMES[enteringDivision.code] ?? enteringDivision.name}</h2>
            <div className="mt-4 flex items-center gap-2.5 text-sm text-sky-100/90">
              <Icon icon="sync" size={17} className="animate-spin" />
              <span>Opening division workspace</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
