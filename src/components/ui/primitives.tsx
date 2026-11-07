import React from 'react';
import { Icon } from './Icon';

/**
 * The pieces the Stitch screens repeat. They live here rather than in each page
 * so that a token change - the card shadow, the pill colours - lands once.
 */

/** Surface the card sits on. `elevated` is for cards that float over a panel. */
export function Card({
  children,
  className = '',
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'li' | 'article' | 'section';
}) {
  return (
    <Tag
      className={`rounded-2xl border border-outline-variant/50 bg-surface-container-lowest shadow-card transition-shadow ${className}`}
    >
      {children}
    </Tag>
  );
}

const CHIP_TONES = {
  present: 'bg-on-tertiary-container/15 text-on-tertiary-container',
  absent: 'bg-error-container text-on-error-container',
  pending: 'bg-surface-container text-on-surface-variant',
  live: 'bg-secondary-fixed text-on-secondary-fixed-variant',
  solid: 'bg-primary-container text-on-primary',
  inverse: 'bg-surface-container-highest text-on-surface',
} as const;

export type ChipTone = keyof typeof CHIP_TONES;

/** Status pill. The icon is optional decoration; the text always carries the state. */
export function Chip({
  children,
  tone = 'pending',
  icon,
  pulse = false,
  className = '',
}: {
  children: React.ReactNode;
  tone?: ChipTone;
  icon?: string;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-label-sm uppercase tracking-wider ${CHIP_TONES[tone]}${className ? ` ${className}` : ''}`}
    >
      {pulse && <span className="h-2 w-2 shrink-0 rounded-full bg-current" aria-hidden />}
      {icon && <Icon icon={icon} size={14} />}
      {children}
    </span>
  );
}

/** Two-tone dot used against the muster progress bar and in the tally row. */
export function Dot({ className = '' }: { className?: string }) {
  return <span aria-hidden className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${className}`} />;
}

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

/**
 * Mutually exclusive view switch (All / Present / Absent). Rendered as a real
 * radio group so the arrow keys move the selection, which a row of buttons does
 * not give you for free.
 */
export function SegmentedFilter<T extends string>({
  options,
  value,
  onChange,
  label,
  className = '',
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={`flex gap-1 rounded-xl border border-outline-variant/50 bg-surface-container-low p-1 ${className}`}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-label-lg transition-colors ${
              selected ? 'bg-primary-container text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span>{option.label}</span>
            {option.count !== undefined && (
              <span className={selected ? 'text-on-primary-container' : 'text-outline'}>({option.count})</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function EmptyState({
  icon = 'inbox',
  title,
  body,
  action,
}: {
  icon?: string;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-container text-outline">
        <Icon icon={icon} size={26} />
      </span>
      <h4 className="mt-3 text-headline-sm text-on-surface">{title}</h4>
      {body && <p className="mt-1 max-w-sm text-body-md text-sm text-on-surface-variant">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/**
 * Sheet that rises from the bottom on a phone and centres on a desktop, which is
 * how the mockups behave at 390px and what an operator expects one-handed.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  // Escape closes the sheet; the backdrop is a real button so the dismiss is
  // reachable by keyboard rather than only by a stray pointer.
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-primary/40 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} max-h-[88dvh] overflow-y-auto rounded-t-2xl bg-surface-container-lowest p-5 shadow-2xl sm:rounded-xl`}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-outline-variant sm:hidden" aria-hidden />
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-headline-md text-on-surface">{title}</h3>
            {description && <p className="mt-0.5 text-body-md text-sm text-on-surface-variant">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant hover:text-on-surface"
          >
            <Icon icon="close" size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Full-width primary action, as the mockups draw it: navy, tall, arrow-tipped. */
export function PrimaryButton({
  children,
  icon = 'arrow_forward',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode; icon?: string | null }) {
  return (
    <button
      {...props}
      className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-label-lg text-base text-on-primary shadow-md transition-transform active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 ${className}`}
    >
      {children}
      {icon && <Icon icon={icon} size={20} />}
    </button>
  );
}
