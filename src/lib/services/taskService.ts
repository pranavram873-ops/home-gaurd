'use client';

import type { TaskItem, TaskPriority, TaskStatus, TaskStatusHistory } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { describeQueryError, describeThrownError, type ListResult, type OneResult } from './queryError';
import { TASK_HISTORY_SELECT, TASK_SELECT } from './selects';

export interface TaskFilters {
  assignedTo?: string | null;
  unitId?: string | null;
  status?: TaskStatus | 'all';
}

/**
 * "Authenticated users view own tasks" plus "Admins view all tasks" mean the same
 * call returns a guard's own queue and an administrator's statewide list.
 */
export async function listTasks(filters: TaskFilters = {}): Promise<ListResult<TaskItem>> {
  try {
    const supabase = createClient();
    let query = supabase
      .from('tasks')
      .select(TASK_SELECT)
      .order('created_at', { ascending: false });

    if (filters.assignedTo) query = query.eq('assigned_to', filters.assignedTo);
    if (filters.unitId) query = query.eq('unit_id', filters.unitId);
    if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status);

    const { data, error } = await query;
    if (error) return { data: [], error: describeQueryError(error) };
    return { data: (data ?? []) as unknown as TaskItem[], error: null };
  } catch (err) {
    return { data: [], error: describeThrownError(err, 'Could not load tasks.') };
  }
}

/** The audit trail under one task, newest first. */
export async function listTaskHistory(
  taskId: string,
): Promise<ListResult<TaskStatusHistory>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('task_status_history')
      .select(TASK_HISTORY_SELECT)
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });

    if (error) return { data: [], error: describeQueryError(error) };
    return { data: (data ?? []) as unknown as TaskStatusHistory[], error: null };
  } catch (err) {
    return { data: [], error: describeThrownError(err, 'Could not load the task history.') };
  }
}

export interface TaskInput {
  title: string;
  description?: string;
  priority: TaskPriority;
  assigned_to?: string | null;
  assigned_by?: string | null;
  unit_id?: string | null;
  duty_assignment_id?: string | null;
  due_date?: string | null;
  /** Defaults to 'assigned' when somebody is named and 'new' when nobody is. */
  status?: TaskStatus;
}

/** Admin-only under "Admins create tasks". */
export async function createTask(input: TaskInput): Promise<OneResult<TaskItem>> {
  const status: TaskStatus =
    input.status ?? (input.assigned_to ? 'assigned' : 'new');

  try {
    const supabase = createClient();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title: input.title.trim(),
        description: input.description?.trim() || null,
        status,
        priority: input.priority,
        assigned_to: input.assigned_to || null,
        assigned_by: input.assigned_by || null,
        unit_id: input.unit_id || null,
        duty_assignment_id: input.duty_assignment_id || null,
        due_date: input.due_date || null,
        created_at: now,
        updated_at: now,
      })
      .select(TASK_SELECT)
      .single();

    if (error) return { data: null, error: describeQueryError(error) };

    const created = data as unknown as TaskItem;

    // Every status is expected to appear in the history table, including the
    // first one, so the trail reads as a complete chain of custody.
    await supabase.from('task_status_history').insert({
      task_id: created.id,
      old_status: null,
      new_status: status,
      changed_by: input.assigned_by || null,
      notes: 'Task created',
      created_at: now,
    });

    return { data: created, error: null };
  } catch (err) {
    return { data: null, error: describeThrownError(err, 'Could not create the task.') };
  }
}

export interface TaskStatusResult {
  task: TaskItem;
  oldStatus: TaskStatus;
}

/**
 * Moves a task along and records the move. The old status is read first because
 * `task_status_history.old_status` describes the transition, not the outcome.
 * A guard may update a task assigned to them or assigned by them; the update
 * policy rejects anyone else and this surfaces that as a permission message.
 */
export async function updateTaskStatus(
  taskId: string,
  newStatus: TaskStatus,
  actorId?: string | null,
  notes?: string,
): Promise<OneResult<TaskStatusResult>> {
  try {
    const supabase = createClient();
    const { data: current, error: readError } = await supabase
      .from('tasks')
      .select('status')
      .eq('id', taskId)
      .single<{ status: TaskStatus }>();

    if (readError) return { data: null, error: describeQueryError(readError) };
    const oldStatus = current.status;

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('tasks')
      .update({
        status: newStatus,
        updated_at: now,
        completed_at: newStatus === 'completed' ? now : null,
      })
      .eq('id', taskId)
      .select(TASK_SELECT)
      .single();

    if (error) return { data: null, error: describeQueryError(error) };

    await supabase.from('task_status_history').insert({
      task_id: taskId,
      old_status: oldStatus,
      new_status: newStatus,
      changed_by: actorId || null,
      notes: notes?.trim() || null,
      created_at: now,
    });

    return { data: { task: data as unknown as TaskItem, oldStatus }, error: null };
  } catch (err) {
    return { data: null, error: describeThrownError(err, 'The task status could not be saved.') };
  }
}
