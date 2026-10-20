'use client';

import React, { useState, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/authContext';
import { UserRole } from '@/types';
import { Lock, Mail, Eye, EyeOff, ShieldAlert, ArrowRight, Loader2 } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(
    searchParams.get('error') === 'pending_approval'
      ? 'Your enrolment is pending approval by Command Headquarters.'
      : searchParams.get('error') === 'inactive_account'
      ? 'This personnel account is currently suspended or inactive.'
      : null
  );

  const handleLogin = async (e?: React.FormEvent, customEmail?: string, roleHint?: UserRole) => {
    if (e) e.preventDefault();
    setErrorMsg(null);

    const loginEmail = customEmail || email;
    if (!loginEmail) {
      setErrorMsg('Please enter your registered official email address.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await login(loginEmail, roleHint);
      if (res.success && res.role) {
        if (res.role === 'admin') router.push('/admin/dashboard');
        else if (res.role === 'commander') router.push('/commander/dashboard');
        else router.push('/homeguard/dashboard');
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

  const quickFill = (userEmail: string, role: UserRole) => {
    setEmail(userEmail);
    setPassword('Police@TN2024');
    handleLogin(undefined, userEmail, role);
  };

  return (
    <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 sm:rounded-xl">
      {errorMsg && (
        <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={(e) => handleLogin(e)} className="space-y-4">
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

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="rounded border-slate-300 text-blue-800 focus:ring-blue-800 w-3.5 h-3.5"
            />
            <span>Remember session securely</span>
          </label>
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

      {/* Quick Demo Switcher / Evaluator Fast-Track */}
      <div className="mt-6 pt-4 border-t border-slate-200">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
          Fast-Track Role Access (One-Click Testing)
        </span>
        <div className="grid grid-cols-1 gap-2">
          <button
            type="button"
            onClick={() => quickFill('admin@tnhomeguards.gov.in', 'admin')}
            className="flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-blue-50 border border-slate-200 text-left transition-colors cursor-pointer"
          >
            <div>
              <span className="text-xs font-bold text-slate-900 block">State Administrator</span>
              <span className="text-[11px] text-slate-500">Dr. K. Vijayakumar, IPS</span>
            </div>
            <span className="text-[10px] font-bold text-blue-900 bg-blue-100 px-2 py-0.5 rounded">
              Admin Roster
            </span>
          </button>

          <button
            type="button"
            onClick={() => quickFill('homeguard@tnhomeguards.gov.in', 'home_guard')}
            className="flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-blue-50 border border-slate-200 text-left transition-colors cursor-pointer"
          >
            <div>
              <span className="text-xs font-bold text-slate-900 block">Home Guard Volunteer</span>
              <span className="text-[11px] text-slate-500">HG A. Venkatesh (Platoon A-2)</span>
            </div>
            <span className="text-[10px] font-bold text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded">
              Duty & Check-in
            </span>
          </button>
        </div>
      </div>

      {/* Registration link */}
      <div className="mt-6 text-center text-xs text-slate-600">
        <span>New volunteer seeking enrolment? </span>
        <Link href="/register" className="font-bold text-blue-800 hover:text-blue-900 underline">
          Submit Enlistment
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#f8fafd] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-block">
          <div className="w-16 h-16 relative mx-auto p-1 rounded-full border border-blue-200 bg-white shadow-xs">
            <Image
              src="/images/tn-home-guards-logo.png"
              alt="Tamil Nadu Home Guards Emblem"
              width={64}
              height={64}
              className="object-contain"
              priority
            />
          </div>
        </Link>
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
