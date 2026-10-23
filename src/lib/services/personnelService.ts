'use client';

import type { AccountStatus, Profile, UserRole } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { describeQueryError, describeThrownError, type ListResult, type OneResult, type ActionResult } from './queryError';
import { PROFILE_SELECT } from './selects';

export interface PersonnelFilters {
  districtId?: string | null;
  unitId?: string | null;
  role?: UserRole | 'all';
  status?: AccountStatus | 'all';
  search?: string;
}

/**
 * The roster. Under RLS an administrator sees every row and a home guard sees
 * only their own, which is why this is only ever called from `/admin/*`.
 */
export async function listPersonnel(filters: PersonnelFilters = {}): Promise<ListResult<Profile>> {
  try {
    const supabase = createClient();
    let query = supabase
      .from('profiles')
      .select(PROFILE_SELECT)
      .order('full_name', { ascending: true });

    if (filters.districtId) query = query.eq('district_id', filters.districtId);
    if (filters.unitId) query = query.eq('unit_id', filters.unitId);
    if (filters.role && filters.role !== 'all') query = query.eq('role', filters.role);
    if (filters.status && filters.status !== 'all') query = query.eq('account_status', filters.status);
    if (filters.search) {
      const term = filters.search.replace(/[,()%]/g, '').trim();
      if (term) query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,personnel_id.ilike.%${term}%`);
    }

    const { data, error } = await query;
    if (error) return { data: [], error: describeQueryError(error) };
    return { data: (data ?? []) as unknown as Profile[], error: null };
  } catch (err) {
    return { data: [], error: describeThrownError(err, 'Could not load the roster.') };
  }
}

/** Active volunteers, for the assign-duty and assign-task pickers. */
export function listActiveGuards(): Promise<ListResult<Profile>> {
  return listPersonnel({ role: 'home_guard', status: 'active' });
}

/**
 * The signed-in user's own dossier, with the district and unit names embedded.
 * `authContext` holds the row it read at sign-in, which has no joins and goes
 * stale once an administrator reassigns a post, so a screen that displays the
 * command hierarchy reads it here instead. RLS resolves this to the guard's own
 * single row: "Users can view own profile" hides everybody else's.
 */
export async function getOwnProfile(userId: string): Promise<OneResult<Profile>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_SELECT)
      .eq('id', userId)
      .maybeSingle();

    if (error) return { data: null, error: describeQueryError(error) };
    return { data: (data ?? null) as Profile | null, error: null };
  } catch (err) {
    return { data: null, error: describeThrownError(err, 'Could not load your profile.') };
  }
}

export interface OwnProfileUpdate {
  phone?: string | null;
  address?: string | null;
  emergency_contact?: string | null;
  blood_group?: string | null;
  avatar_url?: string | null;
}

/**
 * A guard editing their own record. `protect_profile_privilege_escalation`
 * rejects role, status, district and unit changes from anyone but an
 * administrator, so this helper deliberately cannot send those fields.
 */
export async function updateOwnProfile(
  userId: string,
  patch: OwnProfileUpdate,
): Promise<OneResult<Profile>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', userId)
      .select(PROFILE_SELECT)
      .single();

    if (error) return { data: null, error: describeQueryError(error) };
    return { data: data as unknown as Profile, error: null };
  } catch (err) {
    return { data: null, error: describeThrownError(err, 'Could not save your profile.') };
  }
}

export interface StaffAccountInput {
  full_name: string;
  email: string;
  phone?: string | null;
  role: UserRole;
  rank_designation: string;
  district_id: string;
  unit_id?: string | null;
  blood_group?: string | null;
  emergency_contact?: string | null;
  address?: string | null;
}

export interface StaffAccountResult {
  userId: string;
  email: string;
  /** Shown once. It is never stored by the application. */
  temporaryPassword: string;
  /** Set when the account was created but its audit row was not written. */
  auditWarning?: string | null;
}

/**
 * Creates a login plus its profile row. This has to go through the server
 * route: minting an Auth user needs the service key, and RLS on `profiles`
 * only lets a user insert a row whose id is their own uid.
 */
export async function createStaffAccount(
  input: StaffAccountInput,
): Promise<OneResult<StaffAccountResult>> {
  try {
    const response = await fetch('/api/admin/personnel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const payload = (await response.json().catch(() => null)) as
      | (StaffAccountResult & { error?: string })
      | null;

    if (!response.ok || !payload || payload.error) {
      return { data: null, error: payload?.error || 'The staff account could not be created.' };
    }
    return {
      data: {
        userId: payload.userId,
        email: payload.email,
        temporaryPassword: payload.temporaryPassword,
        auditWarning: payload.auditWarning ?? null,
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: describeThrownError(err, 'The staff account could not be created.') };
  }
}

/**
 * Suspend / restore from the roster screen. The badge trigger only fires on the
 * transition into 'active' for a row that has no badge yet, so restoring an
 * officer keeps their existing number.
 */
export async function setAccountStatus(
  userId: string,
  status: AccountStatus,
): Promise<ActionResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from('profiles')
      .update({ account_status: status })
      .eq('id', userId);

    if (error) return { ok: false, error: describeQueryError(error) };
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: describeThrownError(err, 'The account status could not be changed.') };
  }
}

/** Administrator reassignment of an existing officer's district and unit. */
export async function setProfileAssignment(
  userId: string,
  districtId: string | null,
  unitId: string | null,
): Promise<ActionResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from('profiles')
      .update({ district_id: districtId, unit_id: unitId })
      .eq('id', userId);

    if (error) return { ok: false, error: describeQueryError(error) };
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: describeThrownError(err, 'The assignment could not be saved.') };
  }
}
