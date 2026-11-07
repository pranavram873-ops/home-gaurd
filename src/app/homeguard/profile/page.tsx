'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/lib/auth/authContext';
import { useLiveQuery } from '@/lib/hooks/useLiveQuery';
import { getOwnProfile, updateOwnProfile } from '@/lib/services/personnelService';
import type { Profile } from '@/types';
import { Icon } from '@/components/ui/Icon';

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
        <div className="max-w-2xl mx-auto bg-surface-container-lowest rounded-xl border border-outline-variant shadow-xs p-8 flex items-center justify-center gap-2 text-xs text-on-surface-variant">
          <Icon icon="sync" size={16} className="animate-spin" />
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
          <div className="p-4 rounded-xl bg-secondary-fixed border border-secondary-fixed text-on-secondary-fixed-variant text-xs flex items-start gap-3">
            <Icon icon="warning" size={20} className="text-secondary shrink-0 mt-0.5" />
            <p>{dossierQuery.error} The details below are the ones held from sign-in.</p>
          </div>
        )}

        <div className="bg-surface-container-lowest rounded-xl p-5 border border-outline-variant shadow-xs flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary text-on-primary font-extrabold text-xl flex items-center justify-center shrink-0">
            {dossier?.full_name?.charAt(0) || 'G'}
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-on-primary-fixed bg-primary-fixed px-2 py-0.5 rounded border border-outline-variant">
                {dossier?.personnel_id || 'Badge pending'}
              </span>
              <span className="text-xs font-bold text-on-tertiary-fixed-variant bg-tertiary-fixed px-1.5 py-0.5 rounded uppercase">
                {dossier?.account_status === 'active' ? 'Active Cadre' : dossier?.account_status || 'Unverified'}
              </span>
            </div>
            <h2 className="text-lg font-bold text-on-surface mt-1">{dossier?.full_name}</h2>
            <span className="text-xs text-on-surface-variant">
              {dossier?.rank_designation || 'Home Guard Volunteer'}
              {(dossier?.district?.name || dossier?.unit?.name) && ' • '}
              {dossier?.unit?.name || dossier?.district?.name}
            </span>
          </div>
        </div>

        {isSaved && (
          <div className="p-3 rounded-lg bg-tertiary-fixed border border-outline-variant text-on-tertiary-fixed-variant text-xs flex items-center gap-2">
            <Icon icon="check_circle" size={16} className="text-on-tertiary-container shrink-0" />
            <span>Personal contact details updated successfully.</span>
          </div>
        )}

        {formError && (
          <div className="p-3 rounded-lg bg-error-container border border-error-container text-on-error-container text-xs flex items-start gap-2">
            <Icon icon="warning" size={16} className="text-on-error-container shrink-0 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}

        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-xs p-6">
          <h3 className="text-sm font-bold text-on-surface mb-4 pb-2 border-b border-outline-variant">
            Authorized Personnel Information
          </h3>

          <form onSubmit={(e) => void handleSave(e)} className="flex flex-col gap-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-on-surface-variant block mb-1">Assigned Role (Fixed)</label>
                <input
                  type="text"
                  disabled
                  value={dossier?.role === 'admin' ? 'Administrator' : 'Home Guard Volunteer'}
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-low text-on-surface-variant cursor-not-allowed"
                />
              </div>

              <div>
                <label className="font-bold text-on-surface-variant block mb-1">Blood Group (Verified)</label>
                <input
                  type="text"
                  disabled
                  value={dossier?.blood_group || 'Not recorded'}
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-low text-on-surface-variant cursor-not-allowed font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-on-surface-variant block mb-1">District Command</label>
                <div className="flex items-center gap-1.5 px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-low text-on-surface-variant font-semibold">
                  <Icon icon="location_on" size={14} />
                  <span className="truncate">{dossier?.district?.name || 'Not assigned'}</span>
                </div>
              </div>

              <div>
                <label className="font-bold text-on-surface-variant block mb-1">Unit</label>
                <div className="flex items-center gap-1.5 px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-low text-on-surface-variant font-semibold">
                  <Icon icon="verified_user" size={14} />
                  <span className="truncate">{dossier?.unit?.name || 'Not posted to a unit'}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="font-bold text-outline block mb-1">Official Email</label>
              <input
                type="email"
                disabled
                value={dossier?.email || 'Not recorded'}
                className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-low text-on-surface-variant cursor-not-allowed"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-on-surface-variant block mb-1">Contact Mobile</label>
                <input
                  type="tel"
                  required
                  inputMode="numeric"
                  pattern="[0-9]{10}"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg text-on-surface font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-on-surface-variant block mb-1">Emergency Contact</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]{10}"
                  maxLength={10}
                  value={emergency}
                  onChange={(e) => setEmergency(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg text-on-surface font-mono"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-on-surface-variant block mb-1">Residential Address</label>
              <textarea
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 border border-outline-variant rounded-lg text-on-surface"
              />
            </div>

            <p className="text-sm text-on-surface-variant leading-relaxed">
              A badge number, rank, blood group, district or unit transfer can only be amended by an
              administrator, because those columns are enforced by database policy against self-editing.
            </p>

            <div className="pt-3 border-t border-outline-variant">
              <button
                type="submit"
                disabled={isSaving || !dossier}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-label-lg text-on-primary shadow-md transition-transform hover:bg-primary-container active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
              >
                {isSaving && <Icon icon="sync" size={16} className="animate-spin" />}
                Save Contact Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
