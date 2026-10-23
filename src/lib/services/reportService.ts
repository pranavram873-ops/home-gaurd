'use client';

import type { AttendanceEvent, DutyLocation, DutyAssignment, Profile, TaskItem, Unit } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { describeQueryError, describeThrownError, type OneResult } from './queryError';
import { ASSIGNMENT_SELECT, ATTENDANCE_SELECT, LOCATION_SELECT, PROFILE_SELECT, TASK_SELECT, UNIT_SELECT } from './selects';

/**
 * Everything the Reports desk computes its muster roll, geofence exceptions and
 * task completion figures from, in one round of parallel reads.
 *
 * The page deliberately keeps its own arithmetic: this only supplies the rows.
 * Attendance has no `unit_id` column, so a unit filter is applied after each
 * event has been joined to the duty it belongs to — that join is why the
 * assignment embeds are fetched rather than bare ids.
 */
export interface ReportDataset {
  assignments: DutyAssignment[];
  attendance: AttendanceEvent[];
  tasks: TaskItem[];
  units: Unit[];
  locations: DutyLocation[];
  /** Active volunteers, for the strength figures beside the muster rows. */
  guards: Profile[];
}

export async function getReportDataset(): Promise<OneResult<ReportDataset>> {
  try {
    const supabase = createClient();

    const [assignments, attendance, tasks, units, locations, guards] = await Promise.all([
      supabase
        .from('duty_assignments')
        .select(ASSIGNMENT_SELECT)
        .order('duty_date', { ascending: false })
        .limit(1000),
      supabase
        .from('attendance_events')
        .select(ATTENDANCE_SELECT)
        .order('recorded_at', { ascending: false })
        .limit(2000),
      supabase.from('tasks').select(TASK_SELECT).order('created_at', { ascending: false }).limit(1000),
      supabase.from('units').select(UNIT_SELECT).order('name', { ascending: true }),
      supabase.from('duty_locations').select(LOCATION_SELECT).order('name', { ascending: true }),
      supabase
        .from('profiles')
        .select(PROFILE_SELECT)
        .eq('role', 'home_guard')
        .eq('account_status', 'active')
        .order('full_name', { ascending: true }),
    ]);

    const firstError =
      assignments.error || attendance.error || tasks.error || units.error || locations.error || guards.error;
    if (firstError) return { data: null, error: describeQueryError(firstError) };

    return {
      data: {
        assignments: (assignments.data ?? []) as unknown as DutyAssignment[],
        attendance: (attendance.data ?? []) as unknown as AttendanceEvent[],
        tasks: (tasks.data ?? []) as unknown as TaskItem[],
        units: (units.data ?? []) as unknown as Unit[],
        locations: (locations.data ?? []) as unknown as DutyLocation[],
        guards: (guards.data ?? []) as unknown as Profile[],
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: describeThrownError(err, 'Could not load the reporting data.') };
  }
}
