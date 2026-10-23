'use client';

import type { AttendanceEvent, AttendanceEventType } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { describeQueryError, describeThrownError, type ListResult, type OneResult } from './queryError';
import { ATTENDANCE_SELECT } from './selects';

export interface AttendanceFilters {
  /** Omitted, an administrator sees the whole book; a guard only ever sees their own. */
  userId?: string | null;
  locationId?: string | null;
  /** Inclusive ISO date, e.g. '2026-10-23'. */
  from?: string;
  to?: string;
  limit?: number;
}

/**
 * Movement register. "Users view own attendance events" and "Admins view all
 * attendance" are enforced by RLS, so nothing here filters by identity beyond
 * the caller's optional `userId`. There is no unit filter because the table has
 * no `unit_id` column of its own; `reportService` narrows by unit once the rows
 * are joined to their duties in memory.
 */
export async function listAttendance(
  filters: AttendanceFilters = {},
): Promise<ListResult<AttendanceEvent>> {
  try {
    const supabase = createClient();
    let query = supabase
      .from('attendance_events')
      .select(ATTENDANCE_SELECT)
      .order('recorded_at', { ascending: false });

    if (filters.userId) query = query.eq('user_id', filters.userId);
    if (filters.locationId) query = query.eq('location_id', filters.locationId);
    if (filters.from) query = query.gte('recorded_at', `${filters.from}T00:00:00.000Z`);
    if (filters.to) query = query.lte('recorded_at', `${filters.to}T23:59:59.999Z`);
    if (filters.limit) query = query.limit(filters.limit);

    const { data, error } = await query;
    if (error) return { data: [], error: describeQueryError(error) };
    return { data: (data ?? []) as unknown as AttendanceEvent[], error: null };
  } catch (err) {
    return { data: [], error: describeThrownError(err, 'Could not load attendance records.') };
  }
}

export interface CheckInParams {
  location_id: string;
  latitude: number;
  longitude: number;
  event_type: AttendanceEventType;
  duty_assignment_id?: string | null;
  device_info?: string;
  remarks?: string;
}

/**
 * The geofence decision is made on the server, so the client only reports where
 * it is and trusts the answer. See `src/app/api/attendance/check-in/route.ts`.
 * A 422 is not a transport failure: the ping was recorded but fell outside the
 * perimeter, and the message explains the distance.
 */
export async function recordCheckIn(
  params: CheckInParams,
): Promise<OneResult<{ message: string; distanceMeters: number; isWithinGeofence: boolean }>> {
  try {
    const response = await fetch('/api/attendance/check-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const payload = (await response.json().catch(() => null)) as
      | {
          error?: string;
          message?: string;
          distanceMeters?: number;
          isWithinGeofence?: boolean;
        }
      | null;

    if (!payload) {
      return { data: null, error: 'The check-in could not be recorded.' };
    }
    if (payload.error) {
      return { data: null, error: payload.error };
    }
    if (!response.ok && response.status !== 422) {
      return { data: null, error: 'The check-in could not be recorded.' };
    }

    return {
      data: {
        message: payload.message || 'Check-in recorded.',
        distanceMeters: payload.distanceMeters ?? 0,
        isWithinGeofence: payload.isWithinGeofence ?? false,
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: describeThrownError(err, 'The check-in could not be recorded.') };
  }
}
