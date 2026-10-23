'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, Loader2, ShieldX } from 'lucide-react';
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
    <div className="min-h-screen bg-[#f8fafd] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/login" className="inline-block">
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
          Set New Password
        </h2>
        <p className="mt-1 text-xs text-slate-600">
          Establish a secure password for your Home Guard account.
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 sm:rounded-xl">
          {isSuccess ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Password Updated</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Your new security credential has been verified. You may now sign in.
              </p>
              <div className="mt-6">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-blue-800 text-white font-semibold text-xs hover:bg-blue-900"
                >
                  Proceed to Login
                </Link>
              </div>
            </div>
          ) : linkActive === false ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center mx-auto mb-3">
                <ShieldX className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Recovery Link Not Active</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                This reset link is invalid, already used, or has expired. Request a new recovery
                email and open the link it contains.
              </p>
              <div className="mt-6 flex flex-col items-center gap-2">
                <Link
                  href="/forgot-password"
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-blue-800 text-white font-semibold text-xs hover:bg-blue-900"
                >
                  Request New Recovery Link
                </Link>
                <Link href="/login" className="text-xs font-semibold text-slate-600 hover:text-slate-900">
                  Back to Login
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {linkActive === null && (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 text-xs flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Validating your recovery link&hellip;</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700">New Password</label>
                <div className="mt-1 relative rounded-lg shadow-2xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
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

              <div>
                <label className="block text-xs font-semibold text-slate-700">Confirm New Password</label>
                <div className="mt-1 relative rounded-lg shadow-2xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="block w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-800 text-slate-900 placeholder:text-slate-400"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || linkActive === null}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 border border-transparent rounded-lg shadow-xs text-sm font-bold text-white bg-blue-800 hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-800 disabled:opacity-50 transition-all cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Updating Security Key...</span>
                  </>
                ) : (
                  <span>Update Password</span>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
