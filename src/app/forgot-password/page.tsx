'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Mail, ArrowLeft, CheckCircle, Loader2 } from 'lucide-react';
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
    <div className="min-h-screen bg-[#f8fafd] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-block">
          <div className="w-14 h-14 relative mx-auto p-1 rounded-full border border-blue-200 bg-white shadow-xs">
            <Image
              src="/images/tn-home-guards-logo.png"
              alt="Tamil Nadu Home Guards"
              width={56}
              height={56}
              className="object-contain"
              priority
            />
          </div>
        </Link>
        <span className="text-[10px] font-bold text-blue-900 uppercase tracking-widest block mt-3">
          GOVERNMENT OF TAMIL NADU
        </span>
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Password Recovery
        </h2>
        <p className="mt-1 text-xs text-slate-600">
          Enter your registered email address to receive password reset instructions.
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 sm:rounded-xl">
          {isSubmitted ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Recovery Link Dispatched</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                If an authorized personnel account matches <strong className="text-slate-900">{email}</strong>, a secure password reset link has been dispatched.
              </p>
              <div className="mt-6">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-800 text-white font-semibold text-xs hover:bg-blue-900"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Return to Login</span>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700">Official Email</label>
                <div className="mt-1 relative rounded-lg shadow-2xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="officer@tnhomeguards.gov.in"
                    className="block w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-800 text-slate-900 placeholder:text-slate-400"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 border border-transparent rounded-lg shadow-xs text-sm font-bold text-white bg-blue-800 hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-800 disabled:opacity-50 transition-all cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Dispatching Request...</span>
                  </>
                ) : (
                  <span>Send Recovery Email</span>
                )}
              </button>

              <div className="text-center pt-2">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Login</span>
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
