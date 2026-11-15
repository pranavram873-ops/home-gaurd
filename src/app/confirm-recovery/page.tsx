'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';

export default function ConfirmRecoveryPage() {
  const confirmationUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('confirmation_url');
    if (!raw) return '';

    try {
      const url = new URL(raw);
      // Supabase's template variables are inserted into an outer URL. Recover
      // the remaining query fields too when the email template did not encode
      // the nested confirmation URL as one value.
      for (const key of ['token', 'token_hash', 'type', 'redirect_to']) {
        const value = params.get(key);
        if (value && !url.searchParams.has(key)) url.searchParams.set(key, value);
      }
      return url.toString();
    } catch {
      return '';
    }
  }, []);

  return <main className="mx-auto flex min-h-screen max-w-[480px] items-center bg-surface px-4 py-8">
    <Card className="w-full p-6">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-container text-primary"><Icon icon="lock" size={24} /></div>
      <h1 className="text-headline-md text-on-surface">Continue password reset</h1>
      <p className="mt-2 text-sm text-on-surface-variant">Press the button below to verify your reset request and choose a new password.</p>
      {confirmationUrl ? <a href={confirmationUrl} className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-xl bg-primary px-4 font-semibold text-on-primary">Continue to reset password</a> : <p role="alert" className="mt-5 text-sm text-error">This reset link is incomplete. Request a new reset email.</p>}
      <Link href="/forgot-password" className="mt-5 inline-flex text-sm font-medium text-primary hover:underline">Request another link</Link>
    </Card>
  </main>;
}
