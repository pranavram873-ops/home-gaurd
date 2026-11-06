'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/authContext';
import { LOGIN_ROUTE_ERRORS } from '@/lib/auth/errors';
import { loginSchema } from '@/lib/validation';
import { Icon } from '@/components/ui/Icon';
import { Card } from '@/components/ui/primitives';

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
      <div className="flex items-center rounded-lg bg-surface-container-low shadow-sm transition-colors focus-within:bg-surface-container-lowest">
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

  const [email, setEmail] = useState('');
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

    const validation = loginSchema.safeParse({ email, password });
    if (!validation.success) {
      setErrorMsg(validation.error.errors[0]?.message || 'Enter your official email and password.');
      return;
    }

    if (!email) {
      setErrorMsg('Please enter your registered official email address.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await login(email, password);
      if (res.success && res.role) {
        // Honour the page middleware remembered, but only for in-app paths whose
        // prefix matches the signed-in role (no open redirects).
        const requested = searchParams.get('redirect') || '';
        const fallback = res.role === 'admin' ? '/admin/dashboard' : res.role === 'home_guard' ? '/homeguard/dashboard' : '/incharge/divisions';
        const allowed =
          ((requested.startsWith('/admin') || requested.startsWith('/incharge')) && res.role === 'admin') ||
          (requested.startsWith('/homeguard') && res.role === 'home_guard') ||
          (requested.startsWith('/incharge') && res.role === 'incharge');
        router.push(allowed ? requested : fallback);
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
        <div role="alert" className="mb-4 flex items-start gap-2.5 rounded-lg bg-error-container p-3 text-on-error-container">
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
        <div role="status" className="mb-4 flex items-start gap-2.5 rounded-lg bg-tertiary-fixed p-3 text-on-tertiary-fixed-variant">
          <Icon icon="check_circle" size={20} fill className="mt-0.5 shrink-0" />
          <span className="min-w-0 flex-1 text-xs">{infoMsg}</span>
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <Field
          id="dept-email"
          label="Official department email"
          hint="Mandatory"
          icon="shield_person"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="officer.name@tnpolice.gov.in"
          autoComplete="username"
          required
        />

        <Field
          id="dept-password"
          label="Department password"
          hint="Case-sensitive"
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

        <div className="pt-1">
          <Link href="/forgot-password" className="text-label-md text-secondary hover:text-on-secondary-fixed-variant">
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-label-lg text-base text-on-primary shadow-md transition-transform hover:bg-primary-container active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100"
        >
          {isLoading ? (
            <>
              <Icon icon="sync" size={20} className="animate-spin" />
              <span>Authenticating token…</span>
            </>
          ) : (
            <>
              <span>Sign in</span>
              <Icon icon="arrow_forward" size={20} />
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
      <main className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col">
        {/* Ambient command banner. */}
        <div className="relative overflow-hidden bg-primary px-4 pb-8 pt-6 text-on-primary shadow-md">
          <svg
            viewBox="0 0 200 200"
            aria-hidden
            className="pointer-events-none absolute -bottom-10 -right-10 h-64 w-64 fill-current text-on-primary opacity-10"
          >
            <path d="M100 15 L170 50 L170 120 C170 160 100 190 100 190 C100 190 30 160 30 120 L30 50 Z" />
          </svg>

          <div className="relative z-10 mb-1 flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-container-lowest/15 p-2 shadow-inner backdrop-blur-sm">
              <Icon icon="security" size={32} fill className="text-secondary-container" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-label-sm uppercase tracking-wider text-secondary-fixed">Tamil Nadu Police</span>
                <span className="inline-flex items-center gap-0.5 rounded-full bg-tertiary-container px-1.5 py-0.5 text-[13px] font-bold text-tertiary-fixed">
                  <Icon icon="verified" size={12} fill />
                  VERIFIED PORTAL
                </span>
              </div>
              <p className="truncate text-headline-sm tracking-tight text-on-primary">TN Home Guards Roster Portal</p>
            </div>
          </div>

          <div className="relative z-10 flex items-center justify-between gap-2 pt-1">
            <p className="text-label-md text-primary-fixed-dim">Government of Tamil Nadu</p>
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-highest/20 px-2 py-0.5 text-xs font-medium text-primary-fixed">
              <span className="h-2 w-2 rounded-full bg-tertiary-fixed animate-pulse" aria-hidden />
              Muster live
            </span>
          </div>
        </div>

        {/* The card overlaps the banner, which is how the mockup binds the form
            to the identity strip above it. */}
        <div className="relative z-20 -mt-4 flex flex-col gap-4 px-4">
          <Card className="p-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-container text-primary" aria-hidden>
                <Icon icon="location_on" size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <span className="block text-label-sm uppercase text-on-surface-variant">Sign-in node</span>
                <p className="truncate text-label-lg text-on-surface">Secure Command Network</p>
              </div>
              <span className="shrink-0 rounded-md bg-surface-container-low px-2 py-1 text-xs font-bold text-on-tertiary-container">
                VERIFIED
              </span>
            </div>
          </Card>

          <Card className="p-space-md">
            <div className="mb-4 flex items-start justify-between gap-2">
              <div>
                <h1 className="text-headline-md text-on-surface">Welcome back</h1>
                <p className="mt-0.5 text-body-md text-sm text-on-surface-variant">
                  Sign in with your official Incharge or Officer credentials to continue.
                </p>
              </div>
              <Icon icon="badge" size={30} className="shrink-0 text-primary-container opacity-30" />
            </div>
            <Suspense fallback={<p className="py-8 text-center text-xs text-on-surface-variant">Loading sign-in portal…</p>}>
              <LoginForm />
            </Suspense>
          </Card>

          <div className="px-4 pt-2 text-center">
            <div className="mb-1 inline-flex items-center gap-1.5 text-on-surface-variant opacity-80">
              <Icon icon="lock" size={14} />
              <span className="text-label-sm uppercase tracking-wider">Restricted intranet access</span>
            </div>
            <p className="text-[13px] leading-tight text-on-surface-variant">
              Authorized personnel only · Protected under TN Police IT Protocol &amp; Official Secrets Act.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
