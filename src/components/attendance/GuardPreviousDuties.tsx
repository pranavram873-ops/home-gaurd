'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/ui/Icon';
import type { DutyMonthCount } from '@/lib/services/simpleAttendanceService';

function formatMonth(month: string) {
  const [year, value] = month.split('-').map(Number);
  return new Date(year, value - 1, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
}

export function GuardPreviousDuties({ months }: { months: DutyMonthCount[] }) {
  const [open, setOpen] = useState(false);
  const monthsWithData = months.filter((month) => month.present + month.absent > 0);
  const previousMonths = months.slice(1).filter((month) => month.present + month.absent > 0);

  if (monthsWithData.length <= 2 || !previousMonths.length) return null;

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="mt-2 flex min-h-9 w-full items-center justify-between gap-1 rounded-md text-left text-xs font-semibold text-primary hover:underline"
      >
        <span>View previous months’ duties</span>
        <Icon icon="chevron_right" size={18} />
      </button>
      {open && createPortal(
        <div
          className="overlay-enter fixed inset-0 z-[100] flex items-center justify-center bg-surface-container/50 p-4 backdrop-blur-xs"
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}
        >
          <section role="dialog" aria-modal="true" aria-labelledby="previous-duties-title" className="overlay-panel flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-2xl">
            <header className="flex shrink-0 items-center justify-between bg-primary p-4 text-on-primary">
              <h2 id="previous-duties-title" className="font-bold">Previous months’ duties</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close previous duties" className="rounded p-1 hover:bg-white/10">
                <Icon icon="close" size={20} />
              </button>
            </header>
            <ul className="divide-y divide-outline-variant overflow-y-auto overscroll-contain p-4">
              {previousMonths.map((month) => (
                <li key={month.month} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="text-sm font-semibold text-on-surface">{formatMonth(month.month)}</span>
                  <span className="shrink-0 text-right text-sm text-on-surface-variant">
                    <strong className="text-primary">{month.present}</strong> present
                    {month.absent > 0 && <> · {month.absent} absent</>}
                  </span>
                </li>
              ))}
            </ul>
            <footer className="shrink-0 border-t border-outline-variant p-3">
              <button type="button" onClick={() => setOpen(false)} className="min-h-10 w-full rounded-lg bg-surface-container text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high">
                Close
              </button>
            </footer>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
