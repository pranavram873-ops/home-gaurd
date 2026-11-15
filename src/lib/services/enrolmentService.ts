'use client';

import { type ActionResult, type ListResult } from './queryError';

/**
 * A public enrolment waiting for the State Administrator to verify it.
 *
 * Reads and writes go through the browser Supabase client, so Row Level Security
 * decides whether the signed-in account may see or change anything. The two
 * policies that matter here are "Admins can view all profiles" and "Admins can
 * update all profiles"; the `protect_profile_privilege_escalation` trigger
 * rejects a status change from anyone who is not an administrator.
 */
export interface EnrolmentRequest {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  personnel_id: string | null;
  blood_group: string | null;
  emergency_contact: string | null;
  rank_designation: string | null;
  created_at: string | null;
  district_name: string | null;
  unit_name: string | null;
  requested_role: 'admin' | 'incharge' | 'home_guard';
}

/**
 * Pending public enrolments, newest first.
 *
 * A missing administrator role shows up as an empty list under RLS rather than an
 * error, so an empty queue means either nobody has applied or this account is not
 * an administrator — the approvals desk says so in those words.
 */
export async function listEnrolmentRequests(): Promise<ListResult<EnrolmentRequest>> {
  try {
    const response = await fetch('/api/admin/approvals', { cache: 'no-store' });
    const result = await response.json().catch(() => null) as { requests?: EnrolmentRequest[]; error?: string } | null;
    if (!response.ok) return { data: [], error: result?.error || 'The enrolment queue is unavailable.' };
    return { data: result?.requests ?? [], error: null };
  } catch (err) {
    return { data: [], error: err instanceof Error ? err.message : 'The enrolment queue is unavailable.' };
  }
}

async function decide(id: string, status: 'active' | 'rejected'): Promise<ActionResult> {
  try {
    const response = await fetch('/api/admin/approvals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, decision: status === 'active' ? 'approve' : 'reject' }),
    });
    const result = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
    if (!response.ok || !result?.ok) return { ok: false, error: result?.error || 'The decision could not be saved.' };
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'The decision could not be saved.' };
  }
}

/**
 * Grants operational access. The account still needs a confirmed e-mail before
 * Supabase Auth will issue a session — approval removes the personnel gate, the
 * confirmation link removes the auth gate. The `assign_personnel_badge` trigger
 * issues the service number as the row flips to active.
 */
export function approveEnrolmentRequest(id: string): Promise<ActionResult> {
  return decide(id, 'active');
}

/** Leaves the applicant without access; they can re-enrol only with a new account. */
export function rejectEnrolmentRequest(id: string): Promise<ActionResult> {
  return decide(id, 'rejected');
}
