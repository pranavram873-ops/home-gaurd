'use client';

import { createClient } from '@/lib/supabase/client';
import { describeQueryError, describeThrownError, type ActionResult, type ListResult } from './queryError';

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
}

// Each embed names its constraint: `units.commander_id` also references
// `profiles`, and without the hint PostgREST refuses the join with PGRST201
// ("more than one relationship was found for 'profiles' and 'units'").
const REQUEST_COLUMNS = [
  'id', 'full_name', 'email', 'phone', 'personnel_id', 'blood_group',
  'emergency_contact', 'rank_designation', 'created_at',
  'districts!profiles_district_id_fkey ( name )',
  'units!profiles_unit_id_fkey ( name )',
].join(', ');

type RequestRow = Omit<EnrolmentRequest, 'district_name' | 'unit_name'> & {
  districts: { name: string } | null;
  units: { name: string } | null;
};

function toRequest(row: RequestRow): EnrolmentRequest {
  const { districts, units, ...rest } = row;
  return {
    ...rest,
    district_name: districts?.name ?? null,
    unit_name: units?.name ?? null,
  };
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
    const supabase = createClient();
    const { data, error } = await supabase
      .from('profiles')
      .select(REQUEST_COLUMNS)
      .eq('account_status', 'pending')
      .order('created_at', { ascending: false });

    if (error) return { data: [], error: describeQueryError(error) };
    return { data: ((data ?? []) as unknown as RequestRow[]).map(toRequest), error: null };
  } catch (err) {
    return { data: [], error: describeThrownError(err, 'The enrolment queue is unavailable.') };
  }
}

async function decide(id: string, status: 'active' | 'rejected'): Promise<ActionResult> {
  try {
    const supabase = createClient();
    // The extra `account_status = 'pending'` filter means a stale row in this
    // browser cannot overwrite a decision that was already recorded elsewhere.
    const { data, error } = await supabase
      .from('profiles')
      .update({ account_status: status })
      .eq('id', id)
      .eq('account_status', 'pending')
      .select('id');

    if (error) return { ok: false, error: describeQueryError(error) };
    if (!data || data.length === 0) {
      return { ok: false, error: 'That application has already been processed. Refresh the queue.' };
    }
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: describeThrownError(err, 'The decision could not be saved.') };
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
