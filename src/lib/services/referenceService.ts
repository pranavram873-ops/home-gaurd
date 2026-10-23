'use client';

import type { District, DutyLocation, Unit } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { describeQueryError, describeThrownError, type ListResult, type OneResult } from './queryError';
import { DISTRICT_SELECT, LOCATION_SELECT, UNIT_SELECT } from './selects';

export async function listDistricts(): Promise<ListResult<District>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('districts')
      .select(DISTRICT_SELECT)
      .order('name', { ascending: true });

    if (error) return { data: [], error: describeQueryError(error) };
    return { data: (data ?? []) as District[], error: null };
  } catch (err) {
    return { data: [], error: describeThrownError(err, 'Could not load districts.') };
  }
}

/** Units, optionally narrowed to one district. */
export async function listUnits(districtId?: string | null): Promise<ListResult<Unit>> {
  try {
    const supabase = createClient();
    let query = supabase.from('units').select(UNIT_SELECT).order('name', { ascending: true });
    if (districtId) query = query.eq('district_id', districtId);

    const { data, error } = await query;
    if (error) return { data: [], error: describeQueryError(error) };
    return { data: (data ?? []) as unknown as Unit[], error: null };
  } catch (err) {
    return { data: [], error: describeThrownError(err, 'Could not load units.') };
  }
}

/**
 * Duty posts. RLS hides inactive posts from anyone who is not an administrator,
 * so a guard's check-in screen only ever offers posts they may actually use.
 */
export async function listDutyLocations(districtId?: string | null): Promise<ListResult<DutyLocation>> {
  try {
    const supabase = createClient();
    let query = supabase.from('duty_locations').select(LOCATION_SELECT).order('name', { ascending: true });
    if (districtId) query = query.eq('district_id', districtId);

    const { data, error } = await query;
    if (error) return { data: [], error: describeQueryError(error) };
    return { data: (data ?? []) as unknown as DutyLocation[], error: null };
  } catch (err) {
    return { data: [], error: describeThrownError(err, 'Could not load duty posts.') };
  }
}

export interface DutyLocationInput {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  district_id?: string | null;
  unit_id?: string | null;
  is_active?: boolean;
}

/** Admin-only under the "Admins manage duty locations" policy. */
export async function createDutyLocation(
  input: DutyLocationInput,
): Promise<OneResult<DutyLocation>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('duty_locations')
      .insert({
        name: input.name.trim(),
        address: input.address.trim(),
        latitude: input.latitude,
        longitude: input.longitude,
        radius_meters: input.radius_meters,
        district_id: input.district_id || null,
        unit_id: input.unit_id || null,
        is_active: input.is_active ?? true,
      })
      .select(LOCATION_SELECT)
      .single();

    if (error) return { data: null, error: describeQueryError(error) };
    return { data: data as unknown as DutyLocation, error: null };
  } catch (err) {
    return { data: null, error: describeThrownError(err, 'Could not create the duty post.') };
  }
}

/** Partial update; used for retiring a post without deleting its history. */
export async function updateDutyLocation(
  id: string,
  patch: Partial<DutyLocationInput>,
): Promise<OneResult<DutyLocation>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('duty_locations')
      .update(patch)
      .eq('id', id)
      .select(LOCATION_SELECT)
      .single();

    if (error) return { data: null, error: describeQueryError(error) };
    return { data: data as unknown as DutyLocation, error: null };
  } catch (err) {
    return { data: null, error: describeThrownError(err, 'Could not update the duty post.') };
  }
}
