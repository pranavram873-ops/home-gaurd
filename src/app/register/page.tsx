'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { dataService } from '@/lib/services/dataService';
import { registerSchema } from '@/lib/validation';
import { createClient } from '@/lib/supabase/client';
import { getAppUrl, isPublicRegistrationEnabled } from '@/lib/supabase/env';
import { describeSignUpError } from '@/lib/auth/errors';
import { Lock, Mail, User, Phone, MapPin, Shield, CheckCircle, AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const districts = dataService.getDistricts();
  const [selectedDistrict, setSelectedDistrict] = useState(districts[0]?.id || '');
  const units = dataService.getUnits(selectedDistrict);
  const registrationOpen = isPublicRegistrationEnabled();

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
    personnel_id: '',
    district_id: districts[0]?.id || '',
    unit_id: '',
    emergency_contact: '',
    blood_group: 'O+',
    terms: false,
  });

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validate using Zod schema
    const validation = registerSchema.safeParse(formData);
    if (!validation.success) {
      setErrorMsg(validation.error.errors[0]?.message || 'Please complete all required fields properly.');
      return;
    }

    setIsLoading(true);

    try {
      // Creates the Supabase Auth user. The matching `profiles` row is written by
      // the database trigger (handle_new_user) with a hardcoded role of
      // 'home_guard' and status 'pending' — this request never carries a role or
      // status, so public enrolment cannot escalate privileges.
      const district = districts.find((d) => d.id === formData.district_id);
      const unit = units.find((u) => u.id === formData.unit_id);

      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email: formData.email.trim(),
        password: formData.password,
        options: {
          emailRedirectTo: `${getAppUrl() || window.location.origin}/login?notice=email_confirmed`,
          data: {
            full_name: formData.full_name.trim(),
            phone: formData.phone,
            personnel_id: formData.personnel_id.trim() || null,
            blood_group: formData.blood_group,
            emergency_contact: formData.emergency_contact || null,
            district_code: district?.code ?? null,
            unit_code: unit?.code ?? null,
          },
        },
      });

      if (error) {
        setErrorMsg(describeSignUpError(error));
        setIsLoading(false);
        return;
      }

      setIsLoading(false);
      setIsSuccess(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      setErrorMsg(message);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafd] flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-lg text-center">
        <Link href="/login" className="inline-block">
          <div className="w-14 h-14 relative mx-auto p-1 rounded-full border border-blue-200 bg-white shadow-xs">
            <Image
              src="/images/tn-home-guards-logo.png"
              alt="Tamil Nadu Home Guards Emblem"
              width={56}
              height={56}
              className="object-contain"
              priority
            />
          </div>
        </Link>
        <span className="text-[10px] font-bold text-blue-900 uppercase tracking-widest block mt-2">
          GOVERNMENT OF TAMIL NADU
        </span>
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Home Guard Volunteer Enlistment
        </h2>
        <p className="mt-1 text-xs text-slate-600">
          Submit your official application to join the Tamil Nadu Home Guards auxiliary force.
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 sm:rounded-xl">
          {isSuccess ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Enlistment Submitted Successfully</h3>
              <p className="mt-2 text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
                A confirmation email is on its way to <strong className="text-slate-900">{formData.email}</strong>.
                Open that link to activate sign-in. Your roster entry is recorded with status
                <strong className="text-amber-700"> PENDING APPROVAL</strong> and role
                <strong className="text-amber-700"> Home Guard Volunteer</strong>; it goes straight
                to the <strong className="text-amber-700">State Administrator</strong> at Command
                Headquarters, who verifies your identity and activates operational access.
              </p>
              <div className="mt-6">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-blue-800 text-white font-bold text-xs hover:bg-blue-900 shadow-xs"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Return to Login</span>
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

              {!registrationOpen && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                  <Shield className="w-4 h-4 shrink-0 text-amber-700 mt-0.5" />
                  <span>Public enrolment is currently closed. Report to your District Command office.</span>
                </div>
              )}

              {/* Informational security banner */}
              <div className="p-3 rounded-lg bg-blue-50/70 border border-blue-200 text-blue-900 text-xs flex items-start gap-2">
                <Shield className="w-4 h-4 shrink-0 text-blue-700 mt-0.5" />
                <span>
                  All public registrations are enrolled strictly as <strong>Home Guard Volunteer</strong> under pending administrative scrutiny. Privilege escalation is prohibited by law.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Full Legal Name</label>
                <div className="mt-1 relative rounded-lg shadow-2xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="As recorded in Aadhaar / Police verification"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="block w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-800 text-slate-900 placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Email Address</label>
                  <div className="mt-1 relative rounded-lg shadow-2xs">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      required
                      placeholder="name@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="block w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-800 text-slate-900 placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Mobile Number (10 digits)</label>
                  <div className="mt-1 relative rounded-lg shadow-2xs">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Phone className="w-4 h-4" />
                    </div>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      placeholder="9840012345"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })}
                      className="block w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-800 text-slate-900 placeholder:text-slate-400"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Password</label>
                  <div className="mt-1 relative rounded-lg shadow-2xs">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type="password"
                      required
                      minLength={8}
                      placeholder="At least 8 characters"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="block w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-800 text-slate-900 placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Confirm Password</label>
                  <div className="mt-1 relative rounded-lg shadow-2xs">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type="password"
                      required
                      placeholder="Re-enter password"
                      value={formData.confirm_password}
                      onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                      className="block w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-800 text-slate-900 placeholder:text-slate-400"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">District Command</label>
                  <select
                    value={formData.district_id}
                    onChange={(e) => {
                      const newDist = e.target.value;
                      setSelectedDistrict(newDist);
                      setFormData({ ...formData, district_id: newDist });
                    }}
                    className="mt-1 block w-full py-2 px-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-800 text-slate-900 bg-white"
                  >
                    {districts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Blood Group</label>
                  <select
                    value={formData.blood_group}
                    onChange={(e) => setFormData({ ...formData, blood_group: e.target.value })}
                    className="mt-1 block w-full py-2 px-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-800 text-slate-900 bg-white"
                  >
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="flex items-start gap-2 cursor-pointer text-xs text-slate-600 mt-2">
                  <input
                    type="checkbox"
                    checked={formData.terms}
                    onChange={(e) => setFormData({ ...formData, terms: e.target.checked })}
                    className="mt-0.5 rounded border-slate-300 text-blue-800 focus:ring-blue-800 w-3.5 h-3.5"
                  />
                  <span>
                    I solemnly pledge to discharge duties as a Volunteer of the Tamil Nadu Home Guards under the Tamil Nadu Home Guard Act, adhering to all vigilance, discipline, and bandobast standing orders.
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading || !registrationOpen}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-transparent rounded-lg shadow-xs text-sm font-bold text-white bg-blue-800 hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-800 disabled:opacity-50 transition-all cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Submitting Application...</span>
                  </>
                ) : (
                  <span>Submit Enlistment Form</span>
                )}
              </button>

              <div className="text-center text-xs text-slate-600 pt-2 border-t border-slate-100">
                <span>Already enrolled? </span>
                <Link href="/login" className="font-bold text-blue-800 hover:text-blue-900 underline">
                  Sign in here
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
