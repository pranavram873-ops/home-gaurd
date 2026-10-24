'use client';

import React, { useState, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/authContext';
import { LOGIN_ROUTE_ERRORS } from '@/lib/auth/errors';
import { loginSchema } from '@/lib/validation';
import { Lock, Mail, Eye, EyeOff, ShieldAlert, ArrowRight, Loader2, Info } from 'lucide-react';

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
        const fallback = res.role === 'admin' ? '/admin/dashboard' : '/incharge/attendance';
        const allowed =
          ((requested.startsWith('/admin') || requested.startsWith('/incharge')) && res.role === 'admin') ||
          (requested.startsWith('/incharge') && res.role !== 'admin');
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
    <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 sm:rounded-xl">
      {errorMsg && (
        <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {infoMsg && (
        <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2">
          <Info className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
          <span>{infoMsg}</span>
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700">Official Email</label>
          <div className="mt-1 relative rounded-lg shadow-2xs">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Mail className="w-4 h-4" />
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. officer@tnhomeguards.gov.in"
              autoComplete="username"
              required
              className="block w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-800 text-slate-900 placeholder:text-slate-400"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-slate-700">Password</label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-blue-800 hover:text-blue-900"
            >
              Forgot password?
            </Link>
          </div>
          <div className="mt-1 relative rounded-lg shadow-2xs">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Lock className="w-4 h-4" />
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              className="block w-full pl-9 pr-10 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-800 text-slate-900 placeholder:text-slate-400"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-transparent rounded-lg shadow-xs text-sm font-bold text-white bg-blue-800 hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-800 disabled:opacity-50 transition-all cursor-pointer"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Verifying Credentials...</span>
            </>
          ) : (
            <>
              <span>Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#f8fafd] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Plain emblem: the landing page is gone, so this page is the entry point. */}
        <div className="inline-block w-16 h-16 relative mx-auto p-1 rounded-full border border-blue-200 bg-white shadow-xs">
          <Image
            src="/images/tn-home-guards-logo.png"
            alt="Tamil Nadu Home Guards Emblem"
            width={64}
            height={64}
            className="object-contain"
            priority
          />
        </div>
        <span className="text-[10px] font-bold text-blue-900 uppercase tracking-widest block mt-3">
          GOVERNMENT OF TAMIL NADU
        </span>
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Supervision Portal Login
        </h2>
        <p className="mt-1 text-xs text-slate-600">
          Enter your authorized departmental credentials to proceed
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Loading Login Portal...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
