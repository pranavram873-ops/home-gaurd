'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';

const inputClass = 'h-12 w-full rounded-xl border border-outline-variant bg-surface px-4 text-on-surface outline-none transition-colors focus:border-primary';

export default function RegisterPage() {
  const [enabled, setEnabled] = useState(true);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ fullName: '', username: '', email: '', phone: '', requestedRole: '' as '' | 'admin' | 'incharge', password: '', confirm: '' });

  useEffect(() => {
    fetch('/api/auth/registration-options').then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load registration details.');
      setEnabled(Boolean(data.enabled));
    }).catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load registration details.'))
      .finally(() => setLoadingOptions(false));
  }, []);

  const update = (key: keyof typeof form, value: string) => setForm(current => ({ ...current, [key]: value }));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    if (!form.requestedRole) { setError('Choose the type of account you are requesting.'); return; }
    const username = form.username.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,40}$/.test(username)) { setError('Username must be 3–40 letters, numbers, dashes, or underscores.'); return; }
    if (form.password.length < 8) { setError('Use at least 8 characters for your password.'); return; }
    if (form.password !== form.confirm) { setError('The passwords do not match.'); return; }
    if (!enabled) return;
    setBusy(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          username,
          email: form.email.trim(),
          phone: form.phone.trim(),
          requestedRole: form.requestedRole,
          password: form.password,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not create your account.');
      setSubmitted(true);
    } catch (reason) {
      const text = reason instanceof Error ? reason.message : 'Could not create your account.';
      setError(text);
    } finally { setBusy(false); }
  }

  return <main className="mx-auto flex min-h-screen max-w-[560px] items-center bg-surface px-4 py-8">
    <Card className="w-full p-6 sm:p-8">
      <Link href="/login" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"><Icon icon="arrow_back" size={18} /> Back to sign in</Link>
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-container text-primary"><Icon icon="person_add" size={24} /></div>
      <h1 className="text-headline-md text-on-surface">Create an account</h1>
      <p className="mt-1 text-sm text-on-surface-variant">Create an Administrator or Incharge account with a username and password.</p>
      {!enabled ? <p className="mt-5 rounded-xl bg-surface-container p-4 text-sm text-on-surface-variant">Public account creation is currently closed. Please contact Command HQ.</p>
        : submitted ? <div className="mt-5 space-y-4"><p role="status" className="rounded-xl bg-tertiary-fixed p-4 text-sm text-on-tertiary-fixed-variant">Your account is ready. Sign in with your username and password.</p><Link href="/login" className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-primary font-semibold text-on-primary">Sign in</Link></div>
        : loadingOptions ? <p className="py-8 text-center text-sm text-on-surface-variant">Loading account request form…</p>
        : <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
          <fieldset className="sm:col-span-2">
            <legend className="mb-2 block text-sm font-medium text-on-surface">Choose account type</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {([
                ['admin', 'Administrator'],
                ['incharge', 'Incharge'],
              ] as const).map(([value, label]) => (
                <label key={value} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm transition-colors ${form.requestedRole === value ? 'border-primary bg-primary-container/30 text-on-surface' : 'border-outline-variant bg-surface text-on-surface-variant'}`}>
                  <input type="radio" name="requestedRole" value={value} checked={form.requestedRole === value} onChange={() => update('requestedRole', value)} className="accent-primary" required />
                  <span className="font-medium">{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="sm:col-span-2"><label htmlFor="full-name" className="mb-1.5 block text-sm font-medium text-on-surface">Full name</label><input id="full-name" className={inputClass} value={form.fullName} onChange={e => update('fullName', e.target.value)} autoComplete="name" minLength={3} required /></div>
          <div><label htmlFor="username" className="mb-1.5 block text-sm font-medium text-on-surface">Username</label><input id="username" className={inputClass} value={form.username} onChange={e => update('username', e.target.value)} autoComplete="username" placeholder="Choose a username" required /></div>
          <div><label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-on-surface">Mobile number</label><input id="phone" className={inputClass} type="tel" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} value={form.phone} onChange={e => update('phone', e.target.value.replace(/\D/g, '').slice(0, 10))} autoComplete="tel" required /></div>
          <div className="sm:col-span-2"><label htmlFor="email" className="mb-1.5 block text-sm font-medium text-on-surface">Email address</label><input id="email" className={inputClass} type="email" value={form.email} onChange={e => update('email', e.target.value)} autoComplete="email" required /></div>
          <div><label htmlFor="password" className="mb-1.5 block text-sm font-medium text-on-surface">Password</label><input id="password" className={inputClass} type="password" value={form.password} onChange={e => update('password', e.target.value)} minLength={8} autoComplete="new-password" required /></div>
          <div><label htmlFor="confirm" className="mb-1.5 block text-sm font-medium text-on-surface">Confirm password</label><input id="confirm" className={inputClass} type="password" value={form.confirm} onChange={e => update('confirm', e.target.value)} minLength={8} autoComplete="new-password" required /></div>
          {error && <p role="alert" className="sm:col-span-2 text-sm text-error">{error}</p>}
          <button disabled={busy} className="h-12 rounded-xl bg-primary px-4 font-semibold text-on-primary disabled:opacity-60 sm:col-span-2">{busy ? 'Creating account…' : `Create ${form.requestedRole === 'admin' ? 'Administrator' : form.requestedRole === 'incharge' ? 'Incharge' : ''} account`}</button>
        </form>}
    </Card>
  </main>;
}
