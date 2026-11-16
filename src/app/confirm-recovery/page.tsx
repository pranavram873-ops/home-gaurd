'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';
import { createClient } from '@/lib/supabase/client';
import { getRecoveryTokenHash } from '@/lib/auth/recovery-link.mjs';

export default function ConfirmRecoveryPage() {
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const tokenHash = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return getRecoveryTokenHash(window.location.search) || '';
  }, []);

  async function continueToReset() {
    if (!tokenHash || verifying) return;

    setVerifying(true);
    setError('');
    try {
      // Server-generated recovery links have no browser PKCE verifier, so
      // exchange Supabase's one-time token hash directly for the recovery session.
      const { error: verificationError } = await createClient().auth.verifyOtp({
        token_hash: tokenHash,
        type: 'recovery',
      });
      if (verificationError) throw verificationError;
      window.location.replace('/reset-password');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not verify the reset link. Request a new one.');
      setVerifying(false);
    }
  }

  return <main className="mx-auto flex min-h-screen max-w-[480px] items-center bg-surface px-4 py-8">
    <Card className="w-full p-6">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-container text-primary"><Icon icon="lock" size={24} /></div>
      <h1 className="text-headline-md text-on-surface">Continue password reset</h1>
      <p className="mt-2 text-sm text-on-surface-variant">Press the button below to verify your reset request and choose a new password.</p>
      {tokenHash ? <div className="mt-6 space-y-3">
        <button type="button" onClick={continueToReset} disabled={verifying} className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-primary px-4 font-semibold text-on-primary disabled:opacity-60">
          {verifying ? 'Verifying…' : 'Continue to reset password'}
        </button>
        {error && <p role="alert" className="text-sm text-error">{error}</p>}
      </div> : <p role="alert" className="mt-5 text-sm text-error">This reset link is incomplete. Request a new reset email.</p>}
      <Link href="/forgot-password" className="mt-5 inline-flex text-sm font-medium text-primary hover:underline">Request another link</Link>
    </Card>
  </main>;
}
