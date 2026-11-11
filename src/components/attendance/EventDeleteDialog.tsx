'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/ui/Icon';

type EventDeleteDialogProps = {
  title: string;
  description: string;
  deleting: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function EventDeleteDialog({ title, description, deleting, error, onCancel, onConfirm }: EventDeleteDialogProps) {
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => setPortalReady(true), []);
  useEffect(() => {
    if (!portalReady) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !deleting) onCancel();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [deleting, onCancel, portalReady]);

  if (!portalReady) return null;

  return createPortal(
    <div
      className="overlay-enter fixed inset-0 z-[110] flex items-center justify-center bg-primary/40 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !deleting) onCancel(); }}
    >
      <section role="alertdialog" aria-modal="true" aria-labelledby="delete-event-title" aria-describedby="delete-event-description" className="overlay-panel w-full max-w-md rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-2xl sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-error-container text-on-error-container">
            <Icon icon="delete" size={22} />
          </span>
          <div className="min-w-0 pt-0.5">
            <h2 id="delete-event-title" className="text-headline-sm text-on-surface">{title}</h2>
            <p id="delete-event-description" className="mt-1 text-sm leading-6 text-on-surface-variant">{description}</p>
          </div>
        </div>
        {error && <p role="alert" className="mt-4 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">{error}</p>}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} disabled={deleting} className="min-h-11 rounded-lg border border-outline-variant px-4 text-sm font-semibold text-on-surface hover:bg-surface-container disabled:opacity-50">Keep event</button>
          <button type="button" onClick={onConfirm} disabled={deleting} className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-error px-4 text-sm font-semibold text-white hover:bg-error/90 disabled:opacity-60">
            {deleting ? <Icon icon="sync" size={18} className="animate-spin" /> : <Icon icon="delete" size={18} />}
            {deleting ? 'Deleting event…' : 'Delete event'}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
