'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/lib/auth/authContext';
import {
  approveEnrolmentRequest,
  listEnrolmentRequests,
  rejectEnrolmentRequest,
  type EnrolmentRequest,
} from '@/lib/services/enrolmentService';
import { pushNotification } from '@/lib/services/notificationService';
import { writeAuditLog } from '@/lib/services/auditService';
import { formatDate } from '@/lib/utils';
import { Icon } from '@/components/ui/Icon';

export default function ApprovalsPage() {
  const { user, role, isLoading: authLoading } = useAuth();
  const [requests, setRequests] = useState<EnrolmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: rows, error } = await listEnrolmentRequests();
    setRequests(rows);
    setErrorMsg(error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  async function handleDecision(request: EnrolmentRequest, action: 'approve' | 'reject') {
    setBusyId(request.id);
    setErrorMsg(null);
    const result =
      action === 'approve'
        ? await approveEnrolmentRequest(request.id)
        : await rejectEnrolmentRequest(request.id);
    setBusyId(null);

    if (!result.ok) {
      setErrorMsg(result.error || 'The decision could not be saved.');
      return;
    }

    // The decision is already committed, so these two follow-on writes are
    // recorded but never allowed to contradict it: a bell item that fails to
    // insert must not make an approved guard look unapproved to the operator.
    const approved = action === 'approve';
    void pushNotification(request.id, {
      title: approved ? 'Enrolment approved' : 'Enrolment review complete',
      message: approved
        ? `Your application to the Tamil Nadu Home Guards has been verified. Sign in to your duty portal, ${request.full_name}.`
        : 'Your enrolment application could not be approved. Report to your District Command office with identity proof.',
      type: 'approval',
      link: approved ? '/login' : null,
    });
    void writeAuditLog({
      action: approved ? 'APPROVE_REGISTRATION' : 'REJECT_REGISTRATION',
      targetType: 'profile',
      targetId: request.id,
      actorId: user?.id ?? null,
      actorEmail: user?.email ?? null,
      actorRole: 'admin',
      details: { applicant: request.full_name, email: request.email },
    });

    setNotice(
      action === 'approve'
        ? `${request.full_name} is now an active Home Guard Volunteer with an issued service badge and can sign in to the portal.`
        : `Enrolment for ${request.full_name} has been rejected.`,
    );
    void load();
  }

  if (authLoading) {
    return (
      <DashboardLayout title="Enrolment Approvals Desk" subtitle="Tamil Nadu Home Guards • Administrative Verification">
        <div className="flex items-center justify-center gap-2 py-20 text-on-surface-variant text-xs font-semibold">
          <Icon icon="sync" size={16} className="animate-spin" />
          <span>Verifying your authority…</span>
        </div>
      </DashboardLayout>
    );
  }

  if (role !== 'admin') {
    return (
      <DashboardLayout title="Enrolment Approvals Desk" subtitle="Tamil Nadu Home Guards • Administrative Verification">
        <div className="max-w-3xl mx-auto p-6 rounded-xl bg-error-container border border-error-container text-on-error-container text-xs flex items-start gap-3">
          <Icon icon="warning" size={20} className="text-on-error-container shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">Administrator access required</span>
            <p className="text-on-surface-variant leading-relaxed mt-0.5">
              Recruit verification is reserved for the State Administrator account at Command Headquarters.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Enrolment Approvals Desk"
      subtitle="Tamil Nadu Home Guards • Administrative Verification"
    >
      <div className="max-w-5xl mx-auto flex flex-col gap-6">
        {/* Banner */}
        <div className="p-4 rounded-xl bg-primary-fixed border border-outline-variant text-on-primary-fixed text-xs flex items-start gap-3">
          <Icon icon="shield" size={20} className="text-primary shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">Security Governance Mandate</span>
            <p className="text-on-surface-variant leading-relaxed mt-0.5">
              Only the <strong>State Administrator</strong> at Command Headquarters approves public recruit
              applications — there is no Area Command step in this workflow. An approved applicant receives the
              verified <strong>Home Guard Volunteer</strong> cadre status and an official service badge ID.
            </p>
          </div>
        </div>

        {notice && (
          <div className="p-4 rounded-xl bg-tertiary-fixed border border-outline-variant text-on-tertiary-fixed-variant text-xs flex items-center gap-2">
            <Icon icon="check_circle" size={16} className="text-on-tertiary-container shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 rounded-xl bg-error-container border border-error-container text-on-error-container text-xs flex items-start gap-2">
            <Icon icon="warning" size={16} className="text-on-error-container shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Pending Applications List */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-outline-variant flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Icon icon="how_to_reg" size={20} className="text-primary" />
              <h3 className="text-sm font-bold text-on-surface">
                Pending Verification Roster {loading ? '…' : `(${requests.length})`}
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-on-surface-variant hidden sm:inline">
                Live from the personnel database
              </span>
              <button
                onClick={() => void load()}
                disabled={loading}
                className="px-3 py-1.5 rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container-low text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Icon icon="refresh" size={14} className={loading ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          <div className="divide-y divide-outline-variant">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-14 text-on-surface-variant text-xs font-semibold">
                <Icon icon="sync" size={16} className="animate-spin" />
                <span>Loading recruit applications…</span>
              </div>
            ) : requests.length === 0 ? (
              <div className="py-12 text-center text-outline text-xs flex flex-col items-center gap-2">
                <Icon icon="check_circle" size={32} className="text-on-tertiary-container" />
                <span className="font-semibold text-on-surface-variant">All recruit applications processed</span>
                <span className="text-[13px]">No pending applicants in queue.</span>
              </div>
            ) : (
              requests.map((request) => (
                <div
                  key={request.id}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-surface-container-low/60 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary-fixed text-on-secondary-fixed-variant font-extrabold flex items-center justify-center shrink-0">
                      {request.full_name.charAt(0)}
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-on-surface">{request.full_name}</span>
                        <span className="text-xs font-mono font-bold bg-secondary-fixed text-on-secondary-fixed-variant px-1.5 py-0.2 rounded uppercase">
                          Pending Approval
                        </span>
                        {request.rank_designation && (
                          <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">
                            {request.rank_designation}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-on-surface-variant mt-1">
                        <span className="flex items-center gap-1">
                          <Icon icon="mail" size={14} className="text-outline" />
                          {request.email}
                        </span>
                        <span className="flex items-center gap-1 font-mono">
                          <Icon icon="call" size={14} className="text-outline" />
                          {request.phone || 'No phone'}
                        </span>
                        <span>Blood: {request.blood_group || 'Not stated'}</span>
                        <span>App ID: {request.personnel_id || 'Not issued'}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-on-surface-variant mt-1.5">
                        <span className="flex items-center gap-1">
                          <Icon icon="location_on" size={14} className="text-outline" />
                          {request.district_name || 'District not selected'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Icon icon="apartment" size={14} className="text-outline" />
                          {request.unit_name || 'Unit assigned after approval'}
                        </span>
                        {request.emergency_contact && (
                          <span className="flex items-center gap-1">
                            <Icon icon="siren" size={14} className="text-outline" />
                            Emergency: {request.emergency_contact}
                          </span>
                        )}
                        {request.created_at && (
                          <span className="flex items-center gap-1">
                            <Icon icon="schedule" size={14} className="text-outline" />
                            Submitted {formatDate(request.created_at)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => void handleDecision(request, 'reject')}
                      disabled={busyId !== null}
                      className="px-3.5 py-1.5 rounded-lg border border-error-container text-on-error-container hover:bg-error-container text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                    >
                      <Icon icon="cancel" size={14} />
                      <span>Reject</span>
                    </button>
                    <button
                      onClick={() => void handleDecision(request, 'approve')}
                      disabled={busyId !== null}
                      className="px-4 py-1.5 rounded-lg bg-on-tertiary-container hover:bg-on-tertiary-container text-on-primary text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-60"
                    >
                      {busyId === request.id ? (
                        <Icon icon="sync" size={14} className="animate-spin" />
                      ) : (
                        <Icon icon="check_circle" size={14} />
                      )}
                      <span>Verify &amp; Approve</span>
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
