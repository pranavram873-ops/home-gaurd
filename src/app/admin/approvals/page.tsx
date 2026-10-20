'use client';

import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { dataService } from '@/lib/services/dataService';
import { Profile } from '@/types';
import { UserCheck, CheckCircle2, XCircle, AlertTriangle, Shield, Phone, Mail, Clock } from 'lucide-react';

export default function ApprovalsPage() {
  const [pendingGuards, setPendingGuards] = useState(() =>
    dataService.getPersonnel({ status: 'pending' })
  );
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleApprove = (guard: Profile) => {
    dataService.approveRegistration(guard.id, 'home_guard', guard.unit_id || 'unt-chn-1');
    setPendingGuards(dataService.getPersonnel({ status: 'pending' }));
    setSuccessMsg(`Enrolment for ${guard.full_name} has been approved and activated with full operational duty access.`);
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  const handleReject = (guard: Profile) => {
    dataService.rejectRegistration(guard.id, 'Identity verification document discrepancy');
    setPendingGuards(dataService.getPersonnel({ status: 'pending' }));
    setSuccessMsg(`Enrolment for ${guard.full_name} has been rejected.`);
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  return (
    <DashboardLayout
      title="Enrolment Approvals Desk"
      subtitle="Tamil Nadu Home Guards • Administrative Verification"
    >
      <div className="max-w-5xl mx-auto flex flex-col gap-6">
        {/* Banner */}
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-800 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">Security Governance Mandate</span>
            <p className="text-slate-700 leading-relaxed mt-0.5">
              Only authorized Command Administrators may approve public recruit applications. Approved personnel receive the verified <strong>Home Guard Volunteer</strong> cadre status and an official service badge ID.
            </p>
          </div>
        </div>

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Pending Applications List */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-blue-800" />
              <h3 className="text-sm font-bold text-slate-900">
                Pending Verification Roster ({pendingGuards.length})
              </h3>
            </div>
            <span className="text-xs text-slate-500">Awaiting Command Verification</span>
          </div>

          <div className="divide-y divide-slate-100">
            {pendingGuards.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                <span className="font-semibold text-slate-700">All recruit applications processed</span>
                <span className="text-[11px]">No pending applicants in queue.</span>
              </div>
            ) : (
              pendingGuards.map((guard) => (
                <div key={guard.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-900 font-extrabold flex items-center justify-center shrink-0">
                      {guard.full_name.charAt(0)}
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{guard.full_name}</span>
                        <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded uppercase">
                          Pending Approval
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          {guard.email}
                        </span>
                        <span className="flex items-center gap-1 font-mono">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          {guard.phone || 'No phone'}
                        </span>
                        <span>Blood: {guard.blood_group || 'O+'}</span>
                        <span>App ID: {guard.personnel_id}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleReject(guard)}
                      className="px-3.5 py-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                    <button
                      onClick={() => handleApprove(guard)}
                      className="px-4 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Verify & Approve</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
