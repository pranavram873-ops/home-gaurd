'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Card } from '@/components/ui/primitives';
import { createClient } from '@/lib/supabase/client';
import { getAppUrl } from '@/lib/supabase/env';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const supabase = createClient();
      // Recovery links must land on the deployed app's /reset-password page, so the
      // redirect is built from NEXT_PUBLIC_APP_URL when available (falls back to the
      // current origin in local development). The target must also be listed under
      // Supabase → Authentication → URL Configuration → Redirect URLs.
      const baseUrl = getAppUrl() || window.location.origin;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${baseUrl}/reset-password`,
      });

      if (error) {
        // Never reveal whether the address is enrolled; only surface configuration
        // problems an operator needs to fix.
        if (/redirect|url|allow/i.test(error.message)) {
          setErrorMsg(
            'Recovery could not be dispatched because the return address is not allowed. Please contact Command HQ.'
          );
          return;
        }
      }
      // Generic acknowledgement either way (prevents account enumeration).
      setIsSubmitted(true);
    } catch {
      setIsSubmitted(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface">
      <main className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col">
        <div className="relative overflow-hidden bg-[linear-gradient(120deg,#1c2a63_0%,#111a45_55%,#0a0f24_100%)] px-4 pb-8 pt-5 text-on-surface shadow-md">
          <svg
            viewBox="0 0 200 200"
            aria-hidden
            className="pointer-events-none absolute -bottom-10 -right-10 h-64 w-64 fill-current text-on-surface opacity-10"
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
            <h1 className="mt-0.5 text-headline-lg text-on-surface">Password recovery</h1>
            <p className="mt-1 max-w-sm text-body-md text-sm text-primary-fixed/70">
              Enter your registered official email address to receive reset instructions.
            </p>
          </div>
        </div>

        <div className="relative z-20 -mt-4 px-4">
          <Card className="p-space-md">
            {isSubmitted ? (
              <div className="py-4 text-center">
                <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-tertiary-fixed text-on-tertiary-fixed-variant">
                  <Icon icon="check_circle" size={26} fill />
                </span>
                <h2 className="text-headline-sm text-on-surface">Recovery link dispatched</h2>
                <p className="mx-auto mt-2 max-w-xs text-body-md text-sm leading-relaxed text-on-surface-variant">
                  If an authorized personnel account matches <strong className="font-bold text-on-surface">{email}</strong>, a
                  secure reset link has been sent.
                </p>
                <Link
                  href="/login"
                  className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-4 text-label-lg text-on-primary shadow-md active:scale-[0.98]"
                >
                  <Icon icon="arrow_back" size={20} />
                  Return to sign in
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {errorMsg && (
                  <div role="alert" className="flex items-start gap-2.5 rounded-lg bg-error-container p-3 text-on-error-container">
                    <Icon icon="error" size={20} fill className="mt-0.5 shrink-0 text-error" />
                    <span className="min-w-0 flex-1 text-xs">{errorMsg}</span>
                  </div>
                )}

                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label htmlFor="recovery-email" className="text-label-md text-on-surface">Official email</label>
                    <span className="text-label-sm text-secondary">Mandatory</span>
                  </div>
                  <div className="flex items-center rounded-lg bg-surface-container-low shadow-sm transition-colors focus-within:bg-surface-container-lowest">
                    <span className="flex items-center pl-3.5 pr-2 text-on-surface-variant" aria-hidden>
                      <Icon icon="shield_person" size={20} />
                    </span>
                    <input
                      id="recovery-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="officer@tnhomeguards.gov.in"
                      autoComplete="username"
                      className="h-12 w-full min-w-0 bg-transparent pr-3 text-body-md text-sm text-on-surface placeholder:text-outline focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-label-lg text-base text-on-primary shadow-md transition-transform hover:bg-primary-container active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100"
                >
                  {isLoading ? (
                    <>
                      <Icon icon="sync" size={20} className="animate-spin" />
                      <span>Dispatching request…</span>
                    </>
                  ) : (
                    <>
                      <span>Send recovery email</span>
                      <Icon icon="arrow_forward" size={20} />
                    </>
                  )}
                </button>

                <div className="pt-1 text-center">
                  <Link href="/login" className="inline-flex items-center gap-1 text-label-md text-on-surface-variant hover:text-on-surface">
                    <Icon icon="arrow_back" size={16} />
                    Back to sign in
                  </Link>
                </div>
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
