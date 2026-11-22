'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/ui/Icon';

export function ReportAcknowledgementDialog({
  open,
  guardName,
  submitting,
  error,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  guardName: string;
  submitting: boolean;
  error: string;
  onCancel: () => void;
  onSubmit: (actionTaken: string) => void | Promise<void>;
}) {
  const [actionTaken, setActionTaken] = useState('');

  useEffect(() => {
    if (open) setActionTaken('');
  }, [open, guardName]);

  if (!open || typeof document === 'undefined') return null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const action = actionTaken.trim();
    if (action.length < 2) return;
    void onSubmit(action);
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-surface-container/60 p-4 backdrop-blur-xs"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onCancel();
      }}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-lg space-y-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="acknowledge-report-title"
      >
        <div>
          <h2 id="acknowledge-report-title" className="text-lg font-bold text-on-surface">Acknowledge report</h2>
          <p className="mt-1 text-sm text-on-surface-variant">Record the action taken for {guardName}.</p>
        </div>
        <label htmlFor="acknowledgement-action-taken" className="block text-sm font-semibold text-on-surface">
          Action taken <span className="text-error">*</span>
          <textarea
            id="acknowledgement-action-taken"
            required
            minLength={2}
            maxLength={2000}
            rows={5}
            value={actionTaken}
            onChange={(event) => setActionTaken(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-sm font-normal text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Describe the action taken…"
          />
        </label>
        {error && <p role="alert" className="rounded-lg bg-error-container p-3 text-sm text-on-error-container">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" disabled={submitting} onClick={onCancel} className="min-h-10 rounded-lg px-4 text-sm font-semibold text-on-surface-variant hover:bg-surface-container disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" disabled={submitting || actionTaken.trim().length < 2} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-on-primary disabled:opacity-50">
            {submitting && <Icon icon="sync" size={17} className="animate-spin" />}
            {submitting ? 'Saving…' : 'Save acknowledgement'}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
