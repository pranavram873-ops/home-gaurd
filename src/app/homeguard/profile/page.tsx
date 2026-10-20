'use client';

import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/lib/auth/authContext';
import { dataService } from '@/lib/services/dataService';
import { UserCheck, Shield, Phone, Mail, MapPin, CheckCircle2 } from 'lucide-react';

export default function HomeGuardProfilePage() {
  const { user, refreshUser } = useAuth();
  const [phone, setPhone] = useState(user?.phone || '9840345678');
  const [emergency, setEmergency] = useState(user?.emergency_contact || '9840345679');
  const [address, setAddress] = useState(user?.address || 'Mylapore, Chennai, Tamil Nadu');
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (user?.id) {
      // Security: user can update permitted non-privileged profile fields only
      dataService.updatePersonnel(user.id, {
        phone,
        emergency_contact: emergency,
        address,
      });
      refreshUser();
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 4000);
    }
  };

  return (
    <DashboardLayout
      title="My Guard Dossier & Service Profile"
      subtitle="Tamil Nadu Home Guards • Personnel Record"
    >
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-blue-800 text-white font-extrabold text-xl flex items-center justify-center shrink-0">
            {user?.full_name?.charAt(0) || 'G'}
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                {user?.personnel_id || 'TN-HG-52914'}
              </span>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded uppercase">
                Active Cadre
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 mt-1">{user?.full_name}</h2>
            <span className="text-xs text-slate-500">
              {user?.rank_designation || 'Volunteer Guard'} • Zone IV Command
            </span>
          </div>
        </div>

        {isSaved && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Personal contact details updated successfully.</span>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
          <h3 className="text-sm font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">
            Authorized Personnel Information
          </h3>

          <form onSubmit={handleSave} className="flex flex-col gap-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-400 block mb-1">Assigned Role (Fixed)</label>
                <input
                  type="text"
                  disabled
                  value="Home Guard Volunteer"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="font-bold text-slate-400 block mb-1">Blood Group (Verified)</label>
                <input
                  type="text"
                  disabled
                  value={user?.blood_group || 'O+'}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 cursor-not-allowed font-bold"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-400 block mb-1">Official Email</label>
              <input
                type="email"
                disabled
                value={user?.email || 'homeguard@tnhomeguards.gov.in'}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 cursor-not-allowed"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Contact Mobile</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Emergency Contact</label>
                <input
                  type="tel"
                  required
                  value={emergency}
                  onChange={(e) => setEmergency(e.target.value)}
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

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-blue-800 hover:bg-blue-900 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
              >
                Save Contact Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
