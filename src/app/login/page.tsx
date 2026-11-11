'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/authContext';
import { LOGIN_ROUTE_ERRORS } from '@/lib/auth/errors';
import { loginSchema } from '@/lib/validation';
import { Icon } from '@/components/ui/Icon';
import { Card } from '@/components/ui/primitives';
import { useDivision } from '@/lib/attendance/divisionContext';

/**
 * Field shell from the mockups: the icon leads, the input fills, and the whole
 * box lifts off its recessed background once it has focus.
 */
function Field({
  id,
  label,
  hint,
  icon,
  trailing,
  ...input
}: {
  id: string;
  label: string;
  hint?: string;
  icon: string;
  trailing?: React.ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-label-md text-on-surface">{label}</label>
        {hint && <span className="text-label-sm text-secondary">{hint}</span>}
      </div>
      <div className="field-shell flex items-center rounded-lg bg-surface-container-low shadow-sm">
        <span className="flex items-center pl-3.5 pr-2 text-on-surface-variant" aria-hidden>
          <Icon icon={icon} size={20} />
        </span>
        <input
          id={id}
          {...input}
          className="h-12 w-full min-w-0 bg-transparent pr-3 text-body-md text-sm text-on-surface placeholder:text-outline focus:outline-none disabled:opacity-60"
        />
        {trailing}
      </div>
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const { setDivisionId } = useDivision();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(
    LOGIN_ROUTE_ERRORS[searchParams.get('error') || ''] || null
  );
  const [infoMsg, setInfoMsg] = useState<string | null>(
    searchParams.get('notice') === 'email_confirmed'
      ? 'Email verified. You can now sign in with your password.'
      : searchParams.get('notice') === 'password_updated'
      ? 'Password updated. Sign in with your new password.'
      : searchParams.get('notice') === 'enlistment_submitted'
      ? 'Enlistment recorded. Confirm your email, then wait for Command HQ approval.'
      : null
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    const validation = loginSchema.safeParse({ username, password });
    if (!validation.success) {
      setErrorMsg(validation.error.errors[0]?.message || 'Enter your username and password.');
      return;
    }

    if (!username.trim()) {
      setErrorMsg('Please enter your username.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await login(username.trim(), password);
      if (res.success && res.role) {
        // Start each admin/incharge session at the district chooser so their
        // workspace and personnel list begin in the division they selected.
        setDivisionId('');
        const fallback = res.role === 'admin'
          ? '/admin/divisions'
          : res.role === 'home_guard'
            ? '/homeguard/dashboard'
            : '/incharge/divisions';
        router.push(fallback);
        router.refresh();
      } else {
        setErrorMsg(res.error || 'Authentication failed. Please verify your credentials.');
        setIsLoading(false);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setErrorMsg(message);
      setIsLoading(false);
    }
  };

  return (
    <>
      {errorMsg && (
        <div role="alert" className="alert-enter mb-4 flex items-start gap-2.5 rounded-lg bg-error-container p-3 text-on-error-container">
          <Icon icon="error" size={20} fill className="mt-0.5 shrink-0 text-error" />
          <div className="min-w-0 flex-1 text-xs">
            <span className="block text-sm font-bold">Security advisory</span>
            {errorMsg}
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            aria-label="Dismiss"
            className="shrink-0 p-0.5 opacity-60 hover:opacity-100"
          >
            <Icon icon="close" size={16} />
          </button>
        </div>
      )}

      {infoMsg && (
        <div role="status" className="alert-enter mb-4 flex items-start gap-2.5 rounded-lg bg-tertiary-fixed p-3 text-on-tertiary-fixed-variant">
          <Icon icon="check_circle" size={20} fill className="mt-0.5 shrink-0" />
          <span className="min-w-0 flex-1 text-xs">{infoMsg}</span>
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <Field
          id="username"
          label="Username"
          hint="Mandatory"
          icon="shield_person"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter your username"
          autoComplete="username"
          required
        />

        <Field
          id="dept-password"
          label="Password"
          icon="key"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          autoComplete="current-password"
          required
          trailing={
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="flex h-12 shrink-0 items-center px-2 text-on-surface-variant hover:text-on-surface"
            >
              <Icon icon={showPassword ? 'visibility_off' : 'visibility'} size={20} />
            </button>
          }
        />

        <p className="flex items-center gap-2 text-xs text-on-surface-variant">
          <Icon icon="devices" size={17} className="shrink-0 text-secondary" />
          <span>Stay signed in on this device for 30 days.</span>
        </p>

        <button
          type="submit"
          disabled={isLoading}
          className="group flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-label-lg text-base text-on-primary shadow-md transition-all duration-200 hover:bg-primary-container hover:shadow-lg active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100"
        >
          {isLoading ? (
            <>
              <Icon icon="sync" size={20} className="animate-spin" />
              <span>Signing in…</span>
            </>
          ) : (
            <>
              <span>Sign in</span>
              <Icon icon="arrow_forward" size={20} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </form>
    </>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-surface">
      <main className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-surface px-4 py-8 sm:justify-center">
        <div className="auth-enter relative overflow-hidden rounded-t-2xl bg-primary px-6 pb-7 pt-6 text-on-primary">
          <svg
            viewBox="0 0 200 200"
            aria-hidden
            className="pointer-events-none absolute -bottom-10 -right-10 h-64 w-64 fill-current text-on-primary opacity-10"
          >
            <path d="M100 15 L170 50 L170 120 C170 160 100 190 100 190 C100 190 30 160 30 120 L30 50 Z" />
          </svg>

          <div className="relative z-10 mb-1 flex items-center gap-4">
            <span className="flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-2xl bg-white p-1.5 shadow-lg ring-1 ring-white/30">
              <img src="/images/tn-home-guards-logo.png" alt="Tamil Nadu Home Guards emblem" className="h-full w-full object-contain" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-on-primary/70">Tamil Nadu</p>
              <p className="text-xl font-extrabold leading-tight tracking-tight">Home Guards</p>
              <span className="mt-2 block h-1 w-12 rounded-full bg-secondary-fixed" aria-hidden />
            </div>
          </div>
          <div className="relative z-10 flex items-center justify-between gap-2 pt-1">
            <p className="text-label-md text-on-primary/70">Government of Tamil Nadu</p>
          </div>
        </div>

        {/* The card overlaps the banner, which is how the mockup binds the form
            to the identity strip above it. */}
        <div className="auth-enter relative z-20 flex flex-col" style={{ animationDelay: '60ms' }}>
          <Card className="p-space-md">
            <div className="mb-4 flex items-start justify-between gap-2">
              <div>
                <h1 className="text-headline-md text-on-surface">Welcome back</h1>
                <p className="mt-0.5 text-body-md text-sm text-on-surface-variant">
                  Use your personnel username and password to continue.
                </p>
              </div>
              <Icon icon="badge" size={30} className="shrink-0 text-primary-container opacity-30" />
            </div>
            <Suspense fallback={<p className="py-8 text-center text-xs text-on-surface-variant">Loading sign-in portal…</p>}>
              <LoginForm />
            </Suspense>
          </Card>
        </div>
      </main>
    </div>
  );
}
