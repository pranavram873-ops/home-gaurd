'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingLink, setCheckingLink] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    const hasRecoveryFragment = new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery';
    const timeout = window.setTimeout(() => {
      if (active) setCheckingLink(false);
    }, 6000);
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (session && (event === 'PASSWORD_RECOVERY' || event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        setHasSession(true);
      }
      if (event === 'PASSWORD_RECOVERY' || (event === 'INITIAL_SESSION' && (!hasRecoveryFragment || session))) {
        setCheckingLink(false);
      }
    });

    // Register the listener before reading the session so an incoming recovery
    // URL cannot race the form's first render and be mistaken for an expired link.
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (!sessionError && data.session) setHasSession(true);
      if (!hasRecoveryFragment || data.session) setCheckingLink(false);
    });

    return () => {
      active = false;
      window.clearTimeout(timeout);
      listener.subscription.unsubscribe();
    };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    if (password.length < 8) { setError('Use at least 8 characters for your new password.'); return; }
    if (password !== confirm) { setError('The passwords do not match.'); return; }
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session || !hasSession) throw new Error('This reset link is invalid or has expired. Request a new link.');
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      await supabase.auth.signOut();
      setSuccess(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update your password. Request a new reset link.');
    } finally { setLoading(false); }
  }

  return <main className="mx-auto flex min-h-screen max-w-[480px] items-center bg-surface px-4 py-8">
    <Card className="w-full p-6">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-container text-primary"><Icon icon="lock" size={24} /></div>
      <h1 className="text-headline-md text-on-surface">Choose a new password</h1>
      <p className="mt-1 text-sm text-on-surface-variant">Set a new password for your account.</p>
      {success ? <div className="mt-5"><p role="status" className="rounded-xl bg-tertiary-fixed p-3 text-sm text-on-tertiary-fixed-variant">Your password has been updated. Sign in with your new password.</p><Link href="/login?notice=password_updated" className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-xl bg-primary font-semibold text-on-primary">Go to sign in</Link></div> : checkingLink ? <p role="status" className="mt-6 rounded-xl bg-surface-container p-4 text-sm text-on-surface-variant">Verifying your reset link…</p> : !hasSession ? <div className="mt-6 space-y-4"><p role="alert" className="text-sm text-error">This reset link is invalid or has expired. Request a new link.</p><Link href="/forgot-password" className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-primary font-semibold text-on-primary">Request a new link</Link></div> : <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block text-sm font-medium text-on-surface" htmlFor="new-password">New password</label>
        <input id="new-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" className="h-12 w-full rounded-xl border border-outline-variant bg-surface px-4 text-on-surface outline-none focus:border-primary" />
        <label className="block text-sm font-medium text-on-surface" htmlFor="confirm-password">Confirm new password</label>
        <input id="confirm-password" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" className="h-12 w-full rounded-xl border border-outline-variant bg-surface px-4 text-on-surface outline-none focus:border-primary" />
        {error && <p role="alert" className="text-sm text-error">{error} {error.includes('expired') && <Link href="/forgot-password" className="underline">Request another</Link>}</p>}
        <button disabled={loading} className="h-12 w-full rounded-xl bg-primary px-4 font-semibold text-on-primary disabled:opacity-60">{loading ? 'Updating…' : 'Update password'}</button>
      </form>}
    </Card>
  </main>;
}
