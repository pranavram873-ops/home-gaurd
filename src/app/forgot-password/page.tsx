'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';

export default function ForgotPasswordPage() {
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(''); setError(''); setLoading(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not request a password reset.');
      setMessage(result.message);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not request a password reset.');
    } finally { setLoading(false); }
  }

  return <main className="mx-auto flex min-h-screen max-w-[480px] items-center bg-surface px-4 py-8">
    <Card className="w-full p-6">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-container text-primary"><Icon icon="key" size={24} /></div>
      <h1 className="text-headline-md text-on-surface">Reset your password</h1>
      <p className="mt-1 text-sm text-on-surface-variant">Enter your username. If it belongs to an active account, we’ll send a secure reset link to the email address on file.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label htmlFor="username" className="block text-sm font-medium text-on-surface">Username</label>
        <input id="username" value={username} onChange={e => setUsername(e.target.value)} required autoComplete="username" className="h-12 w-full rounded-xl border border-outline-variant bg-surface px-4 text-on-surface outline-none focus:border-primary" placeholder="Your username" />
        {error && <p role="alert" className="text-sm text-error">{error}</p>}
        {message && <div role="status" className="space-y-2 rounded-xl bg-tertiary-fixed p-3 text-sm text-on-tertiary-fixed-variant"><p>{message}</p><p>Check your spam folder too. If no email arrives, contact Command HQ to confirm the email on file and the password reset email service.</p></div>}
        <button disabled={loading} className="h-12 w-full rounded-xl bg-primary px-4 font-semibold text-on-primary disabled:opacity-60">{loading ? 'Sending…' : 'Send reset link'}</button>
      </form>
      <Link href="/login" className="mt-5 inline-flex text-sm font-medium text-primary hover:underline">Back to sign in</Link>
    </Card>
  </main>;
}
