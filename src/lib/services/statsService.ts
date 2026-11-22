'use client';

import type { PostgrestError } from '@supabase/supabase-js';
import type { AttendanceEvent, AuditLog, DutyAssignment, TaskItem } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { describeQueryError, describeThrownError, type OneResult } from './queryError';
import { ASSIGNMENT_SELECT, ATTENDANCE_SELECT, AUDIT_SELECT, TASK_SELECT } from './selects';
import { loadAttendanceEvents, loadDivisionSummaries } from './simpleAttendanceService';

export interface AdminDivisionDashboard {
  selectedDivision: { id: string; name: string } | null;
  openEvents: number;
  totalGuards: number;
  presentToday: number;
  absentToday: number;
  recentReports: Array<{
    id: string;
    divisionId: string;
    divisionName: string;
    guardName: string;
    homeGuardCode: string;
    category: string;
    description: string;
    eventName: string | null;
    eventDate: string | null;
    status: string;
    createdAt: string;
    actionTaken: string | null;
    acknowledgedAt: string | null;
  }>;
  divisionComplaintComparison: Array<{
    divisionId: string;
    divisionName: string;
    currentMonth: number;
    previousMonth: number;
  }>;
}

function localDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Division-scoped figures and activity for the admin home screen. */
export async function getAdminDivisionDashboard(divisionId: string): Promise<OneResult<AdminDivisionDashboard>> {
  try {
    const now = new Date();
    const today = localDateString(now);
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const currentMonth = today.slice(0, 7);
    const currentMonthStartKey = currentMonthStart.toISOString();
    const nextMonthStartKey = nextMonthStart.toISOString();
    const previousMonthStartKey = previousMonthStart.toISOString();
    const divisions = await loadDivisionSummaries(today);
    const selected = divisions.find((division) => division.id === divisionId) ?? null;
    const supabase = createClient();
    let recentReportsQuery = supabase
      .from('personnel_reports')
      .select('id, division_id, division_name, guard_name, home_guard_code, category, description, event_name, event_date, status, created_at, action_taken, acknowledged_at');
    if (divisionId) recentReportsQuery = recentReportsQuery.eq('division_id', divisionId);
    const [attendanceEvents, reports, monthlyReports, rosterCount] = await Promise.all([
      divisionId ? loadAttendanceEvents(currentMonth, divisionId) : Promise.resolve([]),
      recentReportsQuery
        .or(`acknowledged_at.is.null,created_at.gte.${previousMonthStartKey}`)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('personnel_reports')
        .select('division_id, created_at')
        .gte('created_at', previousMonthStartKey)
        .lt('created_at', nextMonthStartKey),
      divisionId ? supabase
        .from('home_guard_roster')
        .select('id', { count: 'exact', head: true })
        .eq('division_id', divisionId) : Promise.resolve({ count: 0, error: null }),
    ]);
    if (reports.error) throw new Error(describeQueryError(reports.error) ?? 'Could not load division reports.');
    if (monthlyReports.error) throw new Error(describeQueryError(monthlyReports.error) ?? 'Could not load monthly division reports.');
    if (rosterCount.error) throw new Error(describeQueryError(rosterCount.error) ?? 'Could not load the division roster.');

    const countsByDivision = new Map<string, { currentMonth: number; previousMonth: number }>();
    for (const report of monthlyReports.data ?? []) {
      const counts = countsByDivision.get(report.division_id) ?? { currentMonth: 0, previousMonth: 0 };
      if (report.created_at >= currentMonthStartKey && report.created_at < nextMonthStartKey) counts.currentMonth += 1;
      else if (report.created_at >= previousMonthStartKey && report.created_at < currentMonthStartKey) counts.previousMonth += 1;
      countsByDivision.set(report.division_id, counts);
    }

    const reportRows = (reports.data ?? []).filter((report) => !divisionId || report.division_id === divisionId);
    const recentReports = reportRows.slice(0, 8).map((report) => ({
      id: report.id,
      divisionId: report.division_id,
      divisionName: report.division_name,
      guardName: report.guard_name,
      homeGuardCode: report.home_guard_code,
      category: report.category,
      description: report.description,
      eventName: report.event_name,
      eventDate: report.event_date,
      status: report.status,
      createdAt: report.created_at,
      actionTaken: report.action_taken,
      acknowledgedAt: report.acknowledged_at,
    }));
    const divisionComplaintComparison = divisions.map((division) => {
      const counts = countsByDivision.get(division.id);
      return {
        divisionId: division.id,
        divisionName: division.name,
        currentMonth: counts?.currentMonth ?? 0,
        previousMonth: counts?.previousMonth ?? 0,
      };
    }).sort((a, b) => a.divisionName.localeCompare(b.divisionName));
    const todayEvents = attendanceEvents.filter((event) => event.date === today);

    return {
      data: {
        selectedDivision: selected ? { id: selected.id, name: selected.name } : null,
        openEvents: attendanceEvents.filter((event) => event.isOpen).length,
        totalGuards: rosterCount.count ?? 0,
        presentToday: todayEvents.reduce((total, event) => total + event.presentCount, 0),
        absentToday: todayEvents.reduce((total, event) => total + event.absentCount, 0),
        recentReports,
        divisionComplaintComparison,
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: describeThrownError(err, 'Could not load the division dashboard.') };
  }
}

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
