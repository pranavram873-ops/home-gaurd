'use client';

import type { PostgrestError } from '@supabase/supabase-js';
import type { AttendanceEvent, AuditLog, DutyAssignment, TaskItem } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { describeQueryError, describeThrownError, type OneResult } from './queryError';
import { ASSIGNMENT_SELECT, ATTENDANCE_SELECT, AUDIT_SELECT, TASK_SELECT } from './selects';

/**
 * Headline figures for the two dashboards.
 *
 * Every number is a `head: true` count, so the rows themselves are never
 * transferred, and each count checks `error` before trusting `count`: PostgREST
 * answers `count: 0` for a blocked or malformed request just as it does for a
 * genuinely empty table, and the two must not look the same on screen.
 */

type CountQuery = PromiseLike<{ count: number | null; error: PostgrestError | null }>;

export interface AdminStats {
  totalRegisteredGuards: number;
  activeGuards: number;
  pendingApprovals: number;
  onDutyCount: number;
  scheduledCount: number;
  completedAssignmentsCount: number;
  pendingTasks: number;
  completedTasks: number;
  totalTasks: number;
  upcomingEvents: number;
  activeDutyLocations: number;
  totalDutyAssignments: number;
  recentAttendance: AttendanceEvent[];
  recentAuditLogs: AuditLog[];
}

export async function getAdminStats(): Promise<OneResult<AdminStats>> {
  try {
    const supabase = createClient();
    const failures: string[] = [];

    const count = async (query: CountQuery): Promise<number> => {
      const { count: total, error } = await query;
      if (error) {
        const described = describeQueryError(error);
        if (described) failures.push(described);
        return 0;
      }
      return total ?? 0;
    };

    const [
      totalRegisteredGuards,
      activeGuards,
      pendingApprovals,
      onDutyCount,
      scheduledCount,
      completedAssignmentsCount,
      totalDutyAssignments,
      pendingTasks,
      completedTasks,
      totalTasks,
      upcomingEvents,
      activeDutyLocations,
    ] = await Promise.all([
      count(supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'home_guard')),
      count(
        supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'home_guard')
          .eq('account_status', 'active'),
      ),
      count(supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('account_status', 'pending')),
      count(
        supabase
          .from('duty_assignments')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'in_progress'),
      ),
      count(supabase.from('duty_assignments').select('id', { count: 'exact', head: true }).eq('status', 'scheduled')),
      count(supabase.from('duty_assignments').select('id', { count: 'exact', head: true }).eq('status', 'completed')),
      count(supabase.from('duty_assignments').select('id', { count: 'exact', head: true })),
      count(
        supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .in('status', ['new', 'assigned', 'in_progress']),
      ),
      count(supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'completed')),
      count(supabase.from('tasks').select('id', { count: 'exact', head: true })),
      count(supabase.from('events').select('id', { count: 'exact', head: true }).in('status', ['planned', 'active'])),
      count(supabase.from('duty_locations').select('id', { count: 'exact', head: true }).eq('is_active', true)),
    ]);

    // Two small ordered selects feed the activity panels; they are real row reads
    // because the tables beneath them need the names and places, not numbers.
    const [attendance, audit] = await Promise.all([
      supabase.from('attendance_events').select(ATTENDANCE_SELECT).order('recorded_at', { ascending: false }).limit(6),
      supabase.from('audit_logs').select(AUDIT_SELECT).order('created_at', { ascending: false }).limit(6),
    ]);

    if (attendance.error) failures.push(describeQueryError(attendance.error) ?? 'Could not load recent check-ins.');
    if (audit.error) failures.push(describeQueryError(audit.error) ?? 'Could not load the audit trail.');

    if (failures.length > 0) {
      return { data: null, error: failures[0] };
    }

    return {
      data: {
        totalRegisteredGuards,
        activeGuards,
        pendingApprovals,
        onDutyCount,
        scheduledCount,
        completedAssignmentsCount,
        totalDutyAssignments,
        pendingTasks,
        completedTasks,
        totalTasks,
        upcomingEvents,
        activeDutyLocations,
        recentAttendance: (attendance.data ?? []) as unknown as AttendanceEvent[],
        recentAuditLogs: (audit.data ?? []) as unknown as AuditLog[],
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: describeThrownError(err, 'Could not load the command overview.') };
  }
}

export interface GuardDashboardStats {
  myDutiesCount: number;
  /** The duty that matters today: an in-progress one, else the next scheduled. */
  myActiveDuty: DutyAssignment | null;
  myAttendanceCount: number;
  myPendingTasksCount: number;
  myCompletedTasksCount: number;
  recentAttendance: AttendanceEvent[];
  myTasks: TaskItem[];
  recentDuties: DutyAssignment[];
}

/**
 * A guard's own figures. These are read as rows rather than as head counts: the
 * dashboard renders the duty card, the task list and the movement log themselves,
 * so counting them separately would be three extra round trips for nothing.
 * RLS restricts every query to the signed-in rows regardless of the arguments.
 */
export async function getGuardDashboardStats(userId: string): Promise<OneResult<GuardDashboardStats>> {
  try {
    const supabase = createClient();

    const [duties, tasks, attendance] = await Promise.all([
      supabase
        .from('duty_assignments')
        .select(ASSIGNMENT_SELECT)
        .eq('assigned_personnel_id', userId)
        .order('duty_date', { ascending: false })
        .order('start_time', { ascending: false }),
      supabase
        .from('tasks')
        .select(TASK_SELECT)
        .eq('assigned_to', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('attendance_events')
        .select(ATTENDANCE_SELECT)
        .eq('user_id', userId)
        .order('recorded_at', { ascending: false })
        .limit(5),
    ]);

    const firstError = duties.error || tasks.error || attendance.error;
    if (firstError) return { data: null, error: describeQueryError(firstError) };

    const dutyRows = (duties.data ?? []) as unknown as DutyAssignment[];
    const taskRows = (tasks.data ?? []) as unknown as TaskItem[];

    return {
      data: {
        myDutiesCount: dutyRows.length,
        myActiveDuty:
          dutyRows.find((d) => d.status === 'in_progress') ??
          dutyRows.find((d) => d.status === 'scheduled') ??
          null,
        myAttendanceCount: (attendance.data ?? []).length,
        myPendingTasksCount: taskRows.filter((t) => t.status !== 'completed' && t.status !== 'cancelled').length,
        myCompletedTasksCount: taskRows.filter((t) => t.status === 'completed').length,
        recentAttendance: (attendance.data ?? []) as unknown as AttendanceEvent[],
        myTasks: taskRows,
        recentDuties: dutyRows.slice(0, 5),
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: describeThrownError(err, 'Could not load your duty summary.') };
  }
}
