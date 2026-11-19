'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/authContext';
import { loadGuardPersonnelMemos, type GuardPersonnelMemo } from '@/lib/services/simpleAttendanceService';
import { Icon } from '@/components/ui/Icon';

function formatMemoDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function GuardPersonnelMemos({
  guardId,
  onNavigate,
}: {
  guardId: string | null;
  onNavigate?: () => void;
}) {
  const { role } = useAuth();
  const [memos, setMemos] = useState<GuardPersonnelMemo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    if (!open) return () => { active = false; };
    if (!guardId) {
      setMemos([]);
      setError('');
      setLoading(false);
      return () => { active = false; };
    }

    setLoading(true);
    setError('');
    loadGuardPersonnelMemos(guardId)
      .then((result) => {
        if (active) setMemos(result);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load this Home Guard’s memos.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [open, guardId]);

  return (
    <div className="w-full">
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="flex min-h-10 w-full items-center justify-between gap-2 rounded-lg px-3 text-sm font-semibold text-primary hover:bg-surface-container-low"
      >
        <span>View memos by event</span>
        <Icon icon="chevron_right" size={20} />
      </button>
      {open && createPortal(
        <div
          className="overlay-enter fixed inset-0 z-[90] flex items-center justify-center bg-surface-container/50 p-4 backdrop-blur-xs"
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}
        >
          <section role="dialog" aria-modal="true" aria-labelledby="personnel-memos-title" className="overlay-panel flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-2xl">
            <header className="flex shrink-0 items-center justify-between bg-primary p-4 text-on-primary">
              <h2 id="personnel-memos-title" className="font-bold">Personnel memos by event</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close memos" className="rounded p-1 hover:bg-white/10">
                <Icon icon="close" size={20} />
              </button>
            </header>
            <div className="min-h-24 overflow-y-auto overscroll-contain p-4">
              {loading ? (
                <p className="text-sm text-on-surface-variant">Loading memos…</p>
              ) : error ? (
                <p role="alert" className="text-sm text-on-error-container">Could not load memos: {error}</p>
              ) : !guardId ? (
                <p className="text-sm text-on-surface-variant">Event memos are unavailable for this profile.</p>
              ) : memos.length ? (
                <ul className="divide-y divide-outline-variant">
                  {memos.map((memo) => {
                    const eventName = memo.event_name || 'Event not specified';
                    const href = memo.event_date && role === 'admin'
                      ? `/admin/events/${memo.division_id}.${memo.event_date}`
                      : memo.event_date && role === 'incharge'
                        ? `/incharge/attendance?date=${encodeURIComponent(memo.event_date)}&division=${encodeURIComponent(memo.division_id)}&event=${encodeURIComponent(eventName)}`
                        : null;

                    return (
                      <li key={memo.id} className="py-3 first:pt-0 last:pb-0">
                        {href ? (
                          <Link
                            href={href}
                            onClick={() => { setOpen(false); onNavigate?.(); }}
                            className="block rounded-md text-sm font-semibold text-primary underline underline-offset-2 hover:text-primary/80"
                          >
                            {eventName}
                          </Link>
                        ) : (
                          <p className="text-sm font-semibold text-on-surface">{eventName}</p>
                        )}
                        <p className="mt-1 text-xs text-on-surface-variant">
                          {memo.event_date ? formatMemoDate(memo.event_date) : 'Event date not specified'}
                          {' · Filed '}
                          {new Date(memo.created_at).toLocaleDateString('en-IN')}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-on-surface-variant">No personnel memos filed.</p>
              )}
            </div>
            <footer className="shrink-0 border-t border-outline-variant p-3">
              <button type="button" onClick={() => setOpen(false)} className="min-h-10 w-full rounded-lg bg-surface-container text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high">
                Close
              </button>
            </footer>
          </section>
        </div>,
        document.body,
      )}
    </div>
  );
}
