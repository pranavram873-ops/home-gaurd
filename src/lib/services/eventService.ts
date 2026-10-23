'use client';

import type { EventAssignment, EventItem, EventStatus, EventType } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { describeQueryError, describeThrownError, type ListResult, type OneResult, type ActionResult } from './queryError';
import { EVENT_ASSIGNMENT_SELECT, EVENT_SELECT } from './selects';

export interface EventFilters {
  districtId?: string | null;
  status?: EventStatus | 'all';
}

/**
 * Bandobast planner list. `assigned_count` is not a column, so the deployments are
 * counted with one extra query over `event_assignments` rather than an aggregate
 * embed: the number on the card then comes from exactly the rows the deployment
 * list reads back.
 */
export async function listEvents(filters: EventFilters = {}): Promise<ListResult<EventItem>> {
  try {
    const supabase = createClient();
    let query = supabase
      .from('events')
      .select(EVENT_SELECT)
      .order('start_time', { ascending: false });

    if (filters.districtId) query = query.eq('district_id', filters.districtId);
    if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status);

    const { data, error } = await query;
    if (error) return { data: [], error: describeQueryError(error) };

    const events = (data ?? []) as unknown as EventItem[];
    if (events.length === 0) return { data: [], error: null };

    const { data: deploymentRows } = await supabase
      .from('event_assignments')
      .select('event_id')
      .in('event_id', events.map((e) => e.id));

    const counts = new Map<string, number>();
    for (const row of (deploymentRows ?? []) as { event_id: string }[]) {
      counts.set(row.event_id, (counts.get(row.event_id) ?? 0) + 1);
    }

    return {
      data: events.map((e) => ({ ...e, assigned_count: counts.get(e.id) ?? 0 })),
      error: null,
    };
  } catch (err) {
    return { data: [], error: describeThrownError(err, 'Could not load operations.') };
  }
}

/** Which guards were mobilised for one operation. */
export async function listEventAssignments(
  eventId?: string | null,
): Promise<ListResult<EventAssignment>> {
  try {
    const supabase = createClient();
    let query = supabase
      .from('event_assignments')
      .select(EVENT_ASSIGNMENT_SELECT)
      .order('assigned_at', { ascending: false });

    if (eventId) query = query.eq('event_id', eventId);

    const { data, error } = await query;
    if (error) return { data: [], error: describeQueryError(error) };
    return { data: (data ?? []) as unknown as EventAssignment[], error: null };
  } catch (err) {
    return { data: [], error: describeThrownError(err, 'Could not load the deployment list.') };
  }
}

export interface EventInput {
  title: string;
  description?: string;
  event_type: EventType;
  venue: string;
  duty_location_id?: string | null;
  district_id?: string | null;
  commander_id?: string | null;
  required_personnel: number;
  /** Local `YYYY-MM-DDTHH:mm` straight from a datetime-local input. */
  start_time: string;
  end_time: string;
  duty_instructions?: string;
}

/** Admin-only under "Admins can manage events" (FOR ALL). */
export async function createEvent(input: EventInput): Promise<OneResult<EventItem>> {
  try {
    const supabase = createClient();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('events')
      .insert({
        title: input.title.trim(),
        description: input.description?.trim() || null,
        event_type: input.event_type,
        venue: input.venue.trim(),
        duty_location_id: input.duty_location_id || null,
        district_id: input.district_id || null,
        commander_id: input.commander_id || null,
        required_personnel: input.required_personnel,
        start_time: new Date(input.start_time).toISOString(),
        end_time: new Date(input.end_time).toISOString(),
        duty_instructions: input.duty_instructions?.trim() || null,
        status: 'planned',
        created_at: now,
        updated_at: now,
      })
      .select(EVENT_SELECT)
      .single();

    if (error) return { data: null, error: describeQueryError(error) };
    return { data: data as unknown as EventItem, error: null };
  } catch (err) {
    return { data: null, error: describeThrownError(err, 'Could not plan the operation.') };
  }
}

/** planned → active → concluded, or cancelled at any point. */
export async function setEventStatus(
  id: string,
  status: EventStatus,
): Promise<ActionResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from('events')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) return { ok: false, error: describeQueryError(error) };
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: describeThrownError(err, 'The operation status could not be saved.') };
  }
}

/**
 * Mobilise one guard onto an operation. `UNIQUE(event_id, personnel_id)` makes a
 * double tap harmless: the insert reports 23505 and the caller sees "already
 * deployed" rather than a duplicate row.
 */
export async function assignPersonnelToEvent(
  eventId: string,
  personnelId: string,
  roleInEvent?: string,
): Promise<ActionResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('event_assignments').insert({
      event_id: eventId,
      personnel_id: personnelId,
      role_in_event: roleInEvent?.trim() || 'Volunteer Guard',
    });

    if (error) {
      if (error.code === '23505') {
        return { ok: false, error: 'That guard is already deployed on this operation.' };
      }
      return { ok: false, error: describeQueryError(error) };
    }
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: describeThrownError(err, 'The guard could not be deployed.') };
  }
}
