'use client';

import type { DutyAssignment, DutyAssignmentStatus } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { describeQueryError, describeThrownError, type ListResult, type OneResult, type ActionResult } from './queryError';
import { ASSIGNMENT_SELECT } from './selects';

export interface AssignmentFilters {
  personnelId?: string | null;
  unitId?: string | null;
  districtId?: string | null;
  status?: DutyAssignmentStatus | 'all';
  /** Inclusive ISO date, e.g. '2026-10-23'. */
  from?: string;
  to?: string;
}

/**
 * Duty roster. The "Personnel view own assignments" policy means a guard gets
 * their own rows and an administrator gets every row.
 */
export async function listDutyAssignments(
  filters: AssignmentFilters = {},
): Promise<ListResult<DutyAssignment>> {
  try {
    const supabase = createClient();
    let query = supabase
      .from('duty_assignments')
      .select(ASSIGNMENT_SELECT)
      .order('duty_date', { ascending: false })
      .order('start_time', { ascending: false });

    if (filters.personnelId) query = query.eq('assigned_personnel_id', filters.personnelId);
    if (filters.unitId) query = query.eq('unit_id', filters.unitId);
    if (filters.districtId) query = query.eq('district_id', filters.districtId);
    if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status);
    if (filters.from) query = query.gte('duty_date', filters.from);
    if (filters.to) query = query.lte('duty_date', filters.to);

    const { data, error } = await query;
    if (error) return { data: [], error: describeQueryError(error) };
    return { data: (data ?? []) as unknown as DutyAssignment[], error: null };
  } catch (err) {
    return { data: [], error: describeThrownError(err, 'Could not load the duty roster.') };
  }
}

export interface DutyAssignmentInput {
  title: string;
  description?: string;
  duty_location_id?: string | null;
  district_id?: string | null;
  unit_id?: string | null;
  assigned_personnel_id: string;
  supervisor_id?: string | null;
  duty_date: string;
  start_time: string;
  end_time: string;
  reporting_instructions?: string;
}

/** Admin-only under "Admins create assignments". */
export async function createDutyAssignment(
  input: DutyAssignmentInput,
): Promise<OneResult<DutyAssignment>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('duty_assignments')
      .insert({
        title: input.title.trim(),
        description: input.description?.trim() || null,
        duty_location_id: input.duty_location_id || null,
        district_id: input.district_id || null,
        unit_id: input.unit_id || null,
        assigned_personnel_id: input.assigned_personnel_id,
        supervisor_id: input.supervisor_id || null,
        duty_date: input.duty_date,
        start_time: input.start_time,
        end_time: input.end_time,
        reporting_instructions: input.reporting_instructions?.trim() || null,
        status: 'scheduled',
      })
      .select(ASSIGNMENT_SELECT)
      .single();

    if (error) return { data: null, error: describeQueryError(error) };
    return { data: data as unknown as DutyAssignment, error: null };
  } catch (err) {
    return { data: null, error: describeThrownError(err, 'Could not create the duty assignment.') };
  }
}

/**
 * Cancelling is a status change rather than a delete: there is no DELETE policy
 * on `duty_assignments`, so attendance history can never be erased by removing
 * the duty it belongs to. `updated_at` is sent explicitly because the column has
 * a default but no trigger to maintain it on update.
 */
export async function setAssignmentStatus(
  id: string,
  status: DutyAssignmentStatus,
): Promise<ActionResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from('duty_assignments')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) return { ok: false, error: describeQueryError(error) };
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: describeThrownError(err, 'The duty status could not be saved.') };
  }
}
