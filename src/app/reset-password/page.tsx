'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { Card } from '@/components/ui/primitives';
import { createClient } from '@/lib/supabase/client';
import { resetPasswordSchema } from '@/lib/validation';
import { describePasswordRecoveryError } from '@/lib/auth/errors';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // A reset link is only usable while the recovery session it created is live.
  const [linkActive, setLinkActive] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;

    try {
      const supabase = createClient();

      // @supabase/ssr exchanges the `?code=` from the emailed link automatically;
      // wait for the initial session so that exchange has settled before deciding.
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (!active) return;
        if (event === 'INITIAL_SESSION') {
          setLinkActive(Boolean(session));
        } else if (session) {
          setLinkActive(true);
        }
      });

      void supabase.auth.getSession().then(({ data }) => {
        if (active && linkActive === null) setLinkActive(Boolean(data.session));
      });

      return () => {
        active = false;
        subscription.unsubscribe();
      };
    } catch (err) {
      console.error('Reset-password session check failed:', err);
      if (active) setLinkActive(false);
      return undefined;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const validation = resetPasswordSchema.safeParse({ password, confirm_password: confirmPassword });
    if (!validation.success) {
      setErrorMsg(validation.error.errors[0]?.message || 'Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setErrorMsg(describePasswordRecoveryError(error));
        setIsLoading(false);
        return;
      }

      // Close the single-purpose recovery session before handing control back.
      await supabase.auth.signOut();
      setIsSuccess(true);
      setIsLoading(false);
      router.replace('/login?notice=password_updated');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Password could not be updated.';
      setErrorMsg(message);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface">
      <main className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col">
        <div className="relative overflow-hidden bg-primary px-4 pb-8 pt-5 text-on-primary shadow-md">
          <svg
            viewBox="0 0 200 200"
            aria-hidden
            className="pointer-events-none absolute -bottom-10 -right-10 h-64 w-64 fill-current text-on-primary opacity-10"
          >
            <path d="M100 15 L170 50 L170 120 C170 160 100 190 100 190 C100 190 30 160 30 120 L30 50 Z" />
          </svg>
          <Link
            href="/login"
            aria-label="Back to sign in"
            className="relative z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-lowest/15 hover:bg-surface-container-lowest/25"
          >
            <Icon icon="arrow_back" size={22} />
          </Link>
          <div className="relative z-10 pt-4">
            <span className="text-label-sm uppercase tracking-wider text-secondary-fixed">Tamil Nadu Police</span>
            <h1 className="mt-0.5 text-headline-lg text-on-primary">Set new password</h1>
            <p className="mt-1 max-w-sm text-body-md text-sm text-on-primary-container">
              Establish a secure password for your Home Guard account.
            </p>
          </div>
        </div>

        <div className="relative z-20 -mt-4 px-4">
          <Card className="p-space-md">
            {isSuccess ? (
              <div className="py-4 text-center">
                <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-tertiary-fixed text-on-tertiary-fixed-variant">
                  <Icon icon="check_circle" size={26} fill />
                </span>
                <h2 className="text-headline-sm text-on-surface">Password updated</h2>
                <p className="mx-auto mt-2 max-w-xs text-body-md text-sm leading-relaxed text-on-surface-variant">
                  Your new security credential has been verified. You may now sign in.
                </p>
                <Link
                  href="/login"
                  className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-label-lg text-on-primary shadow-md active:scale-[0.98]"
                >
                  <span>Proceed to sign in</span>
                  <Icon icon="arrow_forward" size={20} />
                </Link>
              </div>
            ) : linkActive === false ? (
              <div className="py-4 text-center">
                <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-error-container text-error">
                  <Icon icon="shield_lock" size={26} />
                </span>
                <h2 className="text-headline-sm text-on-surface">Recovery link not active</h2>
                <p className="mx-auto mt-2 max-w-xs text-body-md text-sm leading-relaxed text-on-surface-variant">
                  This reset link is invalid, already used, or has expired. Request a new recovery
                  email and open the link it contains.
                </p>
                <div className="mt-6 flex flex-col items-center gap-3">
                  <Link
                    href="/forgot-password"
                    className="inline-flex min-h-12 w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-primary px-5 text-label-lg text-on-primary shadow-md active:scale-[0.98]"
                  >
                    <Icon icon="refresh" size={20} />
                    Request new recovery link
                  </Link>
                  <Link href="/login" className="text-label-md text-on-surface-variant hover:text-on-surface">
                    Back to sign in
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {errorMsg && (
                  <div role="alert" className="flex items-start gap-2.5 rounded-lg bg-error-container p-3 text-on-error-container">
                    <Icon icon="error" size={20} fill className="mt-0.5 shrink-0 text-error" />
                    <span className="min-w-0 flex-1 text-xs">{errorMsg}</span>
                  </div>
                )}

                {linkActive === null && (
                  <div className="flex items-center gap-2 rounded-lg bg-surface-container-low p-3 text-xs text-on-surface-variant">
                    <Icon icon="sync" size={18} className="animate-spin" />
                    <span>Validating your recovery link…</span>
                  </div>
                )}

                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label htmlFor="new-password" className="text-label-md text-on-surface">New password</label>
                    <span className="text-label-sm text-secondary">Min. 8 characters</span>
                  </div>
                  <div className="flex items-center rounded-lg bg-surface-container-low shadow-sm transition-colors focus-within:bg-surface-container-lowest">
                    <span className="flex items-center pl-3.5 pr-2 text-on-surface-variant" aria-hidden>
                      <Icon icon="key" size={20} />
                    </span>
                    <input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter new password"
                      autoComplete="new-password"
                      className="h-12 w-full min-w-0 bg-transparent pr-3 text-body-md text-sm text-on-surface placeholder:text-outline focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="flex h-12 shrink-0 items-center px-2 text-on-surface-variant hover:text-on-surface"
                    >
                      <Icon icon={showPassword ? 'visibility_off' : 'visibility'} size={20} />
                    </button>
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label htmlFor="confirm-password" className="text-label-md text-on-surface">Confirm new password</label>
                    <span className="text-label-sm text-secondary">Mandatory</span>
                  </div>
                  <div className="flex items-center rounded-lg bg-surface-container-low shadow-sm transition-colors focus-within:bg-surface-container-lowest">
                    <span className="flex items-center pl-3.5 pr-2 text-on-surface-variant" aria-hidden>
                      <Icon icon="key" size={20} />
                    </span>
                    <input
                      id="confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      autoComplete="new-password"
                      className="h-12 w-full min-w-0 bg-transparent pr-3 text-body-md text-sm text-on-surface placeholder:text-outline focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || linkActive === null}
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-label-lg text-base text-on-primary shadow-md transition-transform hover:bg-primary-container active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100"
                >
                  {isLoading ? (
                    <>
                      <Icon icon="sync" size={20} className="animate-spin" />
                      <span>Updating security key…</span>
                    </>
                  ) : (
                    <>
                      <span>Update password</span>
                      <Icon icon="arrow_forward" size={20} />
                    </>
                  )}
                </button>
              </form>
            )}
          </Card>

          <p className="px-4 py-6 text-center text-[13px] leading-tight text-on-surface-variant">
            Authorized personnel only · Protected under TN Police IT Protocol &amp; Official Secrets Act.
          </p>
        </div>
      </main>
    </div>
  );
}
