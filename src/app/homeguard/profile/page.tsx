'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/lib/auth/authContext';
import { useLiveQuery } from '@/lib/hooks/useLiveQuery';
import { getOwnProfile, updateOwnProfile } from '@/lib/services/personnelService';
import type { Profile } from '@/types';
import { AlertTriangle, CheckCircle2, Loader2, MapPin, ShieldCheck } from 'lucide-react';

const PHONE_PATTERN = /^[0-9]{10}$/;

export default function HomeGuardProfilePage() {
  const { user, refreshUser } = useAuth();
  const userId = user?.id ?? null;

  // Read from the database rather than the sign-in snapshot, so an officer's
  // district and unit transfers show up without the guard having to sign out.
  const dossierQuery = useLiveQuery<Profile | null>(
    () => (userId ? getOwnProfile(userId) : Promise.resolve({ data: null, error: null })),
    userId ?? 'no-user',
  );

  const dossier = useMemo(() => dossierQuery.data ?? user, [dossierQuery.data, user]);

  const [phone, setPhone] = useState('');
  const [emergency, setEmergency] = useState('');
  const [address, setAddress] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Seed the editable fields from the loaded row instead of from placeholders,
  // so saving without touching anything cannot write a made-up number.
  useEffect(() => {
    if (!dossier) return;
    setPhone(dossier.phone || '');
    setEmergency(dossier.emergency_contact || '');
    setAddress(dossier.address || '');
  }, [dossier]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !dossier) return;

    if (!PHONE_PATTERN.test(phone)) {
      setFormError('Contact mobile must be a valid 10-digit number.');
      return;
    }
    if (emergency && !PHONE_PATTERN.test(emergency)) {
      setFormError('Emergency contact must be a valid 10-digit number.');
      return;
    }

    setIsSaving(true);
    setFormError(null);
    setIsSaved(false);

    // Only the three contact columns are sent. Role, account status, district
    // and unit are refused by `protect_profile_privilege_escalation` for a
    // non-admin, so a payload that tried to change them would fail the whole
    // update rather than just those fields.
    const { error } = await updateOwnProfile(userId, {
      phone,
      emergency_contact: emergency || null,
      address: address.trim() || null,
    });

    setIsSaving(false);

    if (error) {
      setFormError(error);
      return;
    }

    void dossierQuery.refresh();
    refreshUser();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 4000);
  };

  if (dossierQuery.loading) {
    return (
      <DashboardLayout title="My Guard Dossier & Service Profile" subtitle="Tamil Nadu Home Guards • Personnel Record">
        <div className="max-w-2xl mx-auto bg-white rounded-xl border border-slate-200 shadow-xs p-8 flex items-center justify-center gap-2 text-xs text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading your personnel record...
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="My Guard Dossier & Service Profile"
      subtitle="Tamil Nadu Home Guards • Personnel Record"
    >
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        {dossierQuery.error && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <p>{dossierQuery.error} The details below are the ones held from sign-in.</p>
          </div>
        )}

        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-blue-800 text-white font-extrabold text-xl flex items-center justify-center shrink-0">
            {dossier?.full_name?.charAt(0) || 'G'}
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                {dossier?.personnel_id || 'Badge pending'}
              </span>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded uppercase">
                {dossier?.account_status === 'active' ? 'Active Cadre' : dossier?.account_status || 'Unverified'}
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 mt-1">{dossier?.full_name}</h2>
            <span className="text-xs text-slate-500">
              {dossier?.rank_designation || 'Home Guard Volunteer'}
              {(dossier?.district?.name || dossier?.unit?.name) && ' • '}
              {dossier?.unit?.name || dossier?.district?.name}
            </span>
          </div>
        </div>

        {isSaved && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Personal contact details updated successfully.</span>
          </div>
        )}

        {formError && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
          <h3 className="text-sm font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">
            Authorized Personnel Information
          </h3>

          <form onSubmit={(e) => void handleSave(e)} className="flex flex-col gap-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-400 block mb-1">Assigned Role (Fixed)</label>
                <input
                  type="text"
                  disabled
                  value={dossier?.role === 'admin' ? 'Administrator' : 'Home Guard Volunteer'}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="font-bold text-slate-400 block mb-1">Blood Group (Verified)</label>
                <input
                  type="text"
                  disabled
                  value={dossier?.blood_group || 'Not recorded'}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 cursor-not-allowed font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-400 block mb-1">District Command</label>
                <div className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 font-semibold">
                  <MapPin className="w-3.5 h-3.5" />
                  <span className="truncate">{dossier?.district?.name || 'Not assigned'}</span>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-400 block mb-1">Unit</label>
                <div className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span className="truncate">{dossier?.unit?.name || 'Not posted to a unit'}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-400 block mb-1">Official Email</label>
              <input
                type="email"
                disabled
                value={dossier?.email || 'Not recorded'}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 cursor-not-allowed"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Contact Mobile</label>
                <input
                  type="tel"
                  required
                  inputMode="numeric"
                  pattern="[0-9]{10}"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Emergency Contact</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]{10}"
                  maxLength={10}
                  value={emergency}
                  onChange={(e) => setEmergency(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Residential Address</label>
              <textarea
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
            </div>

            <p className="text-[10px] text-slate-400 leading-relaxed">
              A badge number, rank, blood group, district or unit transfer can only be amended by an
              administrator, because those columns are enforced by database policy against self-editing.
            </p>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={isSaving || !dossier}
                className="px-5 py-2 rounded-lg bg-blue-800 hover:bg-blue-900 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center gap-2"
              >
                {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save Contact Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
