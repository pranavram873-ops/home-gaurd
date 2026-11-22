'use client';

import { createClient } from '@/lib/supabase/client';
import { describeQueryError, describeThrownError, type ListResult } from './queryError';

export interface AttendanceDivision {
  id: string;
  code: string;
  name: string;
}

/** One card on the division-chooser screen. */
export interface DivisionSummary {
  id: string;
  code: string;
  name: string;
  guardCount: number;
  presentCount: number;
  absentCount: number;
  /** A bandobast duty is running against this division today. */
  bandobast: { id: string; title: string } | null;
}

export interface RosterGuard {
  id: string;
  division_id: string;
  full_name: string;
  phone: string;
  home_guard_code: string;
  is_active: boolean;
  date_of_birth: string | null;
  joining_date: string | null;
}

export interface DailyMark {
  id: string;
  guard_id: string;
  division_id: string;
  event_id: string | null;
  attendance_date: string;
  status: 'present' | 'absent';
  photo_url?: string | null;
  marked_at: string;
}

export interface MusterEvent {
  id: string;
  division_id: string;
  event_date: string;
  event_name: string;
  address?: string | null;
  evidence_photos?: string[] | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export async function loadAttendancePage(divisionId: string, date: string, eventId?: string) {
  const supabase = createClient();
  const [divisions, roster, initialMusterEvents] = await Promise.all([
    supabase.from('attendance_divisions').select('id, code, name').order('name'),
    divisionId
      ? supabase
          .from('home_guard_roster')
          .select('id, division_id, full_name, phone, home_guard_code, is_active, date_of_birth, joining_date')
          .eq('division_id', divisionId)
          .eq('is_active', true)
          .order('full_name')
      : Promise.resolve({ data: [], error: null }),
    divisionId
      ? supabase
          .from('muster_events')
          .select('id, division_id, event_date, event_name, address, evidence_photos, created_by, created_at, updated_at')
          .eq('division_id', divisionId)
          .eq('event_date', date)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);

  let musterEventsResult = initialMusterEvents;
  if (musterEventsResult.error && (musterEventsResult.error.message.includes('address') || musterEventsResult.error.message.includes('evidence_photos'))) {
    const optionalColumns = ['address', 'evidence_photos'];
    let selectedOptionalColumns = [...optionalColumns];
    let fallbackMusterEvents;

    for (let attempt = 0; attempt <= optionalColumns.length; attempt += 1) {
      const columns = [
        'id', 'division_id', 'event_date', 'event_name',
        ...selectedOptionalColumns,
        'created_by', 'created_at', 'updated_at',
      ].join(', ');
      fallbackMusterEvents = await supabase
        .from('muster_events')
        .select(columns)
        .eq('division_id', divisionId)
        .eq('event_date', date)
        .order('created_at', { ascending: true });

      if (!fallbackMusterEvents.error) break;
      const message = fallbackMusterEvents.error.message.toLowerCase();
      const unavailableColumns = selectedOptionalColumns.filter((column) => message.includes(column));
      if (unavailableColumns.length === 0) break;
      selectedOptionalColumns = selectedOptionalColumns.filter((column) => !unavailableColumns.includes(column));
    }

    if (fallbackMusterEvents) musterEventsResult = fallbackMusterEvents as typeof musterEventsResult;
  }

  const error = divisions.error || roster.error || musterEventsResult.error;
  if (error) throw new Error(error.message);

  const musterEvents = (musterEventsResult.data ?? []) as MusterEvent[];
  const musterEvent = eventId
    ? musterEvents.find((event) => event.id === eventId) ?? null
    : musterEvents.length === 1 ? musterEvents[0] : null;
  if (eventId && !musterEvent) throw new Error('This event could not be found for the selected division and date.');

  const loadMarks = (includePhoto: boolean) => {
    let query = supabase
      .from('daily_attendance')
      .select(includePhoto
        ? 'id, guard_id, division_id, event_id, attendance_date, status, photo_url, marked_at'
        : 'id, guard_id, division_id, event_id, attendance_date, status, marked_at')
      .eq('division_id', divisionId)
      .eq('attendance_date', date);
    query = musterEvent ? query.eq('event_id', musterEvent.id) : query.is('event_id', null);
    return query;
  };
  let marks = divisionId ? await loadMarks(true) : { data: [], error: null };
  if (marks.error && marks.error.message.includes('photo_url')) marks = await loadMarks(false) as typeof marks;
  if (marks.error) throw new Error(marks.error.message);

  return {
    divisions: (divisions.data ?? []) as AttendanceDivision[],
    roster: (roster.data ?? []) as RosterGuard[],
    marks: (marks.data ?? []) as DailyMark[],
    musterEvent,
    musterEvents,
  };
}

export async function listDivisionRoster(divisionId: string): Promise<ListResult<RosterGuard>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('home_guard_roster')
      .select('id, division_id, full_name, phone, home_guard_code, is_active, date_of_birth, joining_date')
      .eq('division_id', divisionId)
      .eq('is_active', true)
      .order('full_name');
    if (error) return { data: [], error: describeQueryError(error) };
    return { data: (data ?? []) as RosterGuard[], error: null };
  } catch (error) {
    return { data: [], error: describeThrownError(error, 'Could not load the division roster.') };
  }
}

export async function saveMusterEvent(
  divisionId: string,
  date: string,
  eventName: string,
  address?: string,
  eventId?: string,
): Promise<MusterEvent> {
  const supabase = createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error('Please sign in again to create this event.');

  const payload: Record<string, unknown> = {
    division_id: divisionId,
    event_date: date,
    event_name: eventName.trim(),
    updated_at: new Date().toISOString(),
  };
  if (!eventId) payload.created_by = authData.user.id;
  if (address !== undefined && address.trim()) {
    payload.address = address.trim();
  }

  const save = () => eventId
    ? supabase.from('muster_events').update(payload).eq('id', eventId)
    : supabase.from('muster_events').insert(payload);
  const { data, error } = await save()
    .select('id, division_id, event_date, event_name, address, evidence_photos, created_by, created_at, updated_at')
    .single();

  if (error) {
    if (error.message.includes('address')) {
      delete payload.address;
      const fallback = await save()
        .select('id, division_id, event_date, event_name, created_by, created_at, updated_at')
        .single();
      if (fallback.error) throw new Error(fallback.error.message);
      return fallback.data as MusterEvent;
    }
    throw new Error(error.message);
  }
  return data as MusterEvent;
}

export async function deleteMusterEvent(eventId: string): Promise<void> {
  const { data, error } = await createClient()
    .from('muster_events')
    .delete()
    .eq('id', eventId)
    .select('id')
    .maybeSingle();
  if (error) throw new Error(describeQueryError(error) || 'Could not delete this event.');
  if (!data) throw new Error('This event was not found or you do not have permission to delete it.');
}

export async function deleteLegacyAttendanceDay(divisionId: string, date: string): Promise<void> {
  const { error } = await createClient().rpc('delete_muster_event_and_attendance', {
    p_division_id: divisionId,
    p_event_date: date,
  });
  if (error) throw new Error(describeQueryError(error) || 'Could not delete this legacy attendance day.');
}

export async function getMusterEventParticipants(eventId: string): Promise<string[]> {
  const { data, error } = await createClient().from('muster_event_participants').select('guard_id').eq('event_id', eventId);
  if (error) throw new Error(describeQueryError(error) || 'Could not load selected personnel.');
  return (data ?? []).map((row) => row.guard_id as string);
}

export interface GuardDutyCount {
  attended: number;
  notAttended: number;
}

export async function loadGuardDutyCounts(guardIds: string[]): Promise<Map<string, GuardDutyCount>> {
  const uniqueGuardIds = [...new Set(guardIds)];
  const counts = new Map(uniqueGuardIds.map((guardId) => [guardId, { attended: 0, notAttended: 0 }]));
  const supabase = createClient();
  const batchSize = 100;
  const pageSize = 1000;

  for (let start = 0; start < uniqueGuardIds.length; start += batchSize) {
    const guardIdBatch = uniqueGuardIds.slice(start, start + batchSize);
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase
        .from('daily_attendance')
        .select('guard_id, status')
        .in('guard_id', guardIdBatch)
        .order('attendance_date', { ascending: true })
        .order('guard_id', { ascending: true })
        .range(offset, offset + pageSize - 1);
      if (error) throw new Error(describeQueryError(error) || 'Could not load duty counts.');

      const rows = data ?? [];
      for (const row of rows) {
        const count = counts.get(row.guard_id);
        if (!count) continue;
        if (row.status === 'present') count.attended += 1;
        else if (row.status === 'absent') count.notAttended += 1;
      }
      if (rows.length < pageSize) break;
    }
  }

  return counts;
}

export async function setMusterEventParticipant(eventId: string, guardId: string, selected: boolean): Promise<void> {
  const supabase = createClient();
  const result = selected
    ? await supabase.from('muster_event_participants').upsert({ event_id: eventId, guard_id: guardId }, { onConflict: 'event_id,guard_id' })
    : await supabase.from('muster_event_participants').delete().eq('event_id', eventId).eq('guard_id', guardId);
  if (result.error) throw new Error(describeQueryError(result.error) || 'Could not update event personnel.');
}

/**
 * Admin-only removal of a Home Guard profile: drops them from the active
 * division roster, suspends any matching personnel account, and clears
 * event memberships so they stop appearing on muster lists.
 */
export async function deactivateHomeGuard(guardId: string, phone: string, homeGuardCode: string): Promise<void> {
  const supabase = createClient();
  const { error: rosterError } = await supabase
    .from('home_guard_roster')
    .update({ is_active: false })
    .eq('id', guardId);
  if (rosterError) throw new Error(describeQueryError(rosterError) || 'Could not remove this Home Guard.');

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ account_status: 'suspended' })
    .or(`phone.eq.${phone},personnel_id.ilike.${homeGuardCode}`);
  if (profileError) throw new Error(describeQueryError(profileError) || 'Could not suspend the personnel profile.');

  const { error: memberError } = await supabase
    .from('muster_event_participants')
    .delete()
    .eq('guard_id', guardId);
  if (memberError) throw new Error(describeQueryError(memberError) || 'Could not clear event memberships.');
}

/**
 * Per-division figures for the chooser screen. Rosters are small, so the
 * counts come from full rows rather than a database aggregate. Bandobast is
 * matched honestly: the `events` table has no division column, so an operation
 * only shows on a card when its venue names that division.
 */
export async function loadDivisionSummaries(date: string): Promise<DivisionSummary[]> {
  const supabase = createClient();
  const dayStart = new Date(`${date}T00:00:00`);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const [divisions, roster, marks, events] = await Promise.all([
    supabase.from('attendance_divisions').select('id, code, name').order('name'),
    supabase.from('home_guard_roster').select('id, division_id').eq('is_active', true),
    supabase
      .from('daily_attendance')
      .select('guard_id, division_id, status')
      .eq('attendance_date', date),
    supabase
      .from('events')
      .select('id, title, venue, start_time, end_time')
      .in('status', ['planned', 'active'])
      .lte('start_time', dayEnd.toISOString())
      .gte('end_time', dayStart.toISOString()),
  ]);
  const error = divisions.error || roster.error || marks.error || events.error;
  if (error) throw new Error(error.message);

  const rosterByDivision = new Map<string, number>();
  for (const guard of (roster.data ?? []) as Array<{ id: string; division_id: string }>) {
    rosterByDivision.set(guard.division_id, (rosterByDivision.get(guard.division_id) ?? 0) + 1);
  }
  const presentByDivision = new Map<string, number>();
  const absentByDivision = new Map<string, number>();
  for (const mark of (marks.data ?? []) as Array<{ division_id: string; status: string }>) {
    const bucket = mark.status === 'present' ? presentByDivision : absentByDivision;
    bucket.set(mark.division_id, (bucket.get(mark.division_id) ?? 0) + 1);
  }
  const activeEvents = (events.data ?? []) as Array<{ id: string; title: string; venue: string | null }>;

  return ((divisions.data ?? []) as AttendanceDivision[]).map((division) => {
    const bandobast = activeEvents.find(
      (event) => (event.venue ?? '').toLowerCase().includes(division.name.toLowerCase()),
    );
    return {
      ...division,
      guardCount: rosterByDivision.get(division.id) ?? 0,
      presentCount: presentByDivision.get(division.id) ?? 0,
      absentCount: absentByDivision.get(division.id) ?? 0,
      bandobast: bandobast ? { id: bandobast.id, title: bandobast.title } : null,
    };
  });
}

/** A bandobast-duty operation overlapping a duty day, for the workspace panel. */
export interface BandobastEvent {
  id: string;
  title: string;
  venue: string | null;
}

export async function loadBandobastForDate(date: string): Promise<BandobastEvent[]> {
  const supabase = createClient();
  const dayStart = new Date(`${date}T00:00:00`);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const { data, error } = await supabase
    .from('events')
    .select('id, title, venue')
    .in('status', ['planned', 'active'])
    .lte('start_time', dayEnd.toISOString())
    .gte('end_time', dayStart.toISOString());
  if (error) throw new Error(error.message);
  return (data ?? []) as BandobastEvent[];
}

/**
 * A division-day muster summary for the admin events list. A row appears when
 * that division/date has a named event or attendance activity in the month.
 */
export interface AttendanceEventSummary {
  /** Composite route key; named events include their database id. */
  id: string;
  eventId: string | null;
  divisionId: string;
  divisionName: string;
  date: string;
  eventName: string | null;
  presentCount: number;
  absentCount: number;
  sanctionedCount: number;
  markedCount: number;
  /** True when the muster day is still open for marking (today or later). */
  isOpen: boolean;
}

export function attendanceEventId(divisionId: string, date: string, eventId?: string | null) {
  return eventId ? `${divisionId}.${date}.${eventId}` : `${divisionId}.${date}`;
}

export function parseAttendanceEventId(id: string): { divisionId: string; date: string; eventId: string | null } | null {
  const parts = id.split('.');
  if (parts.length !== 2 && parts.length !== 3) return null;
  const [divisionId, date, eventId] = parts;
  if (!divisionId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (eventId && !/^[0-9a-f-]{36}$/i.test(eventId)) return null;
  return { divisionId, date, eventId: eventId ?? null };
}

/**
 * Every named event and legacy attendance-only day in the given month,
 * narrowed to one division when `divisionId` is supplied.
 */
export async function loadAttendanceEvents(
  month: string,
  divisionId: string | null,
): Promise<AttendanceEventSummary[]> {
  const supabase = createClient();
  const from = `${month}-01`;
  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${month}-${String(lastDay).padStart(2, '0')}`;
  let marksQuery = supabase
    .from('daily_attendance')
    .select('guard_id, division_id, event_id, attendance_date, status')
    .gte('attendance_date', from)
    .lte('attendance_date', to)
    .order('attendance_date', { ascending: false });
  let musterEventsQuery = supabase
    .from('muster_events')
    .select('id, division_id, event_date, event_name')
    .gte('event_date', from)
    .lte('event_date', to)
    .order('event_date', { ascending: false });
  if (divisionId) {
    marksQuery = marksQuery.eq('division_id', divisionId);
    musterEventsQuery = musterEventsQuery.eq('division_id', divisionId);
  }

  const [divisions, roster, marks, musterEvents] = await Promise.all([
    supabase.from('attendance_divisions').select('id, code, name').order('name'),
    supabase.from('home_guard_roster').select('id, division_id').eq('is_active', true),
    marksQuery,
    musterEventsQuery,
  ]);
  const error = divisions.error || roster.error || marks.error || musterEvents.error;
  if (error) throw new Error(error.message);

  const nameById = new Map<string, string>();
  for (const division of (divisions.data ?? []) as AttendanceDivision[]) {
    nameById.set(division.id, division.name);
  }
  const sanctionedByDivision = new Map<string, number>();
  for (const guard of (roster.data ?? []) as Array<{ division_id: string }>) {
    sanctionedByDivision.set(guard.division_id, (sanctionedByDivision.get(guard.division_id) ?? 0) + 1);
  }

  const today = todayISO();
  const marksByEvent = new Map<string, { present: number; absent: number }>();
  const legacyMarksByDay = new Map<string, { present: number; absent: number }>();
  for (const mark of (marks.data ?? []) as Array<{
    division_id: string;
    event_id: string | null;
    attendance_date: string;
    status: string;
  }>) {
    if (divisionId && mark.division_id !== divisionId) continue;
    const key = mark.event_id ?? attendanceEventId(mark.division_id, mark.attendance_date);
    const buckets = mark.event_id ? marksByEvent : legacyMarksByDay;
    const bucket = buckets.get(key) ?? { present: 0, absent: 0 };
    if (mark.status === 'present') bucket.present += 1;
    else bucket.absent += 1;
    buckets.set(key, bucket);
  }

  const summaries: AttendanceEventSummary[] = (
    (musterEvents.data ?? []) as Array<{ id: string; division_id: string; event_date: string; event_name: string }>
  ).filter((event) => !divisionId || event.division_id === divisionId).map((event) => {
    const counts = marksByEvent.get(event.id) ?? { present: 0, absent: 0 };
    const markedCount = counts.present + counts.absent;
    return {
      id: attendanceEventId(event.division_id, event.event_date, event.id),
      eventId: event.id,
      divisionId: event.division_id,
      divisionName: nameById.get(event.division_id) ?? 'Unknown division',
      date: event.event_date,
      eventName: event.event_name,
      presentCount: counts.present,
      absentCount: counts.absent,
      sanctionedCount: sanctionedByDivision.get(event.division_id) ?? markedCount,
      markedCount,
      isOpen: event.event_date >= today,
    };
  });

  for (const [key, counts] of legacyMarksByDay) {
    const parsed = parseAttendanceEventId(key);
    if (!parsed) continue;
    const markedCount = counts.present + counts.absent;
    summaries.push({
      id: key,
      eventId: null,
      divisionId: parsed.divisionId,
      divisionName: nameById.get(parsed.divisionId) ?? 'Unknown division',
      date: parsed.date,
      eventName: null,
      presentCount: counts.present,
      absentCount: counts.absent,
      sanctionedCount: sanctionedByDivision.get(parsed.divisionId) ?? markedCount,
      markedCount,
      isOpen: parsed.date >= today,
    });
  }
  summaries.sort((a, b) => (a.date === b.date ? a.divisionName.localeCompare(b.divisionName) : a.date < b.date ? 1 : -1));
  return summaries;
}

function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export async function saveDailyMark(
  guardId: string,
  divisionId: string,
  date: string,
  eventId: string,
  status: 'present' | 'absent',
) {
  const supabase = createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error('Please sign in again to save attendance.');
  if (!eventId) throw new Error('Choose an event before saving attendance.');
  const { error } = await supabase.from('daily_attendance').upsert(
    {
      guard_id: guardId,
      division_id: divisionId,
      event_id: eventId,
      attendance_date: date,
      status,
      marked_by: authData.user.id,
      marked_at: new Date().toISOString(),
    },
    { onConflict: 'guard_id,event_id' },
  );
  if (error) throw new Error(error.message);
}

export async function clearDailyMark(guardId: string, divisionId: string, date: string, eventId: string): Promise<void> {
  if (!eventId) throw new Error('Choose an event before clearing attendance.');
  const { error } = await createClient()
    .from('daily_attendance')
    .delete()
    .eq('guard_id', guardId)
    .eq('division_id', divisionId)
    .eq('attendance_date', date)
    .eq('event_id', eventId);
  if (error) throw new Error(describeQueryError(error) || 'Could not clear attendance for this event.');
}

export async function addRosterGuard(input: {
  full_name: string;
  phone: string;
  home_guard_code: string;
  division_id: string;
  date_of_birth: string;
  joining_date: string;
}) {
  const supabase = createClient();
  const { error } = await supabase.from('home_guard_roster').insert({
    ...input,
    full_name: input.full_name.trim(),
    phone: input.phone.trim(),
    home_guard_code: input.home_guard_code.trim().toUpperCase(),
  });
  if (error) throw new Error(error.code === '23505' ? 'That Home Guard code is already in use.' : error.message);
}

export async function addRosterGuards(inputs: Array<{
  full_name: string;
  phone: string;
  home_guard_code: string;
  division_id: string;
}>) {
  if (!inputs.length) throw new Error('Paste at least one Home Guard row first.');
  const supabase = createClient();
  const { error } = await supabase.from('home_guard_roster').insert(inputs.map((input) => ({
    ...input,
    full_name: input.full_name.trim(),
    phone: input.phone.trim(),
    home_guard_code: input.home_guard_code.trim().toUpperCase(),
  })));
  if (error) throw new Error(error.code === '23505' ? 'A Home Guard code in this list is already in use.' : error.message);
}

export interface DutyMonthCount {
  /** `YYYY-MM` */
  month: string;
  present: number;
  absent: number;
}

export interface GuardDutyHistory {
  guardId: string;
  homeGuardCode: string;
  divisionId: string;
  divisionName: string;
  dateOfBirth: string | null;
  joiningDate: string | null;
  months: DutyMonthCount[];
  events: Array<{
    date: string;
    eventId: string | null;
    eventName: string | null;
    status: 'present' | 'absent';
  }>;
}

/**
 * Duty history for a profile from the muster register, for the admin roster.
 * `profiles` and `home_guard_roster` are separate lists with no key between
 * them, so the match is on the mobile number, the one field both capture.
 * Returns null when no roster guard carries that number (or the profile has
 * none), which the caller shows as "not linked" rather than zero duties.
 * Month buckets are the current month plus the five before it.
 */
export async function loadGuardDutyHistory(phone: string | null | undefined): Promise<GuardDutyHistory | null> {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length < 10) return null;
  const tail = digits.slice(-10);
  const supabase = createClient();
  const { data: guards, error: guardsError } = await supabase
    .from('home_guard_roster')
    .select('id, division_id, home_guard_code, date_of_birth, joining_date, attendance_divisions(name)')
    .like('phone', `%${tail}%`)
    .eq('is_active', true);
  if (guardsError) throw new Error(guardsError.message);
  const guard = (guards ?? [])[0] as
    | {
        id: string;
        division_id: string;
        home_guard_code: string;
        date_of_birth: string | null;
        joining_date: string | null;
        attendance_divisions: { name: string }[];
      }
    | undefined;
  if (!guard) return null;

  // Six `YYYY-MM` buckets, newest first.
  const now = new Date();
  const monthKeys: string[] = [];
  for (let back = 0; back < 6; back += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
    monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const [{ data: marks, error: marksError }, { data: musterEvents, error: eventsError }] = await Promise.all([
    supabase
      .from('daily_attendance')
      .select('event_id, attendance_date, status')
      .eq('guard_id', guard.id)
      .gte('attendance_date', `${monthKeys[5]}-01`),
    supabase
      .from('muster_events')
      .select('id, event_date, event_name')
      .eq('division_id', guard.division_id)
      .gte('event_date', `${monthKeys[5]}-01`),
  ]);
  if (marksError) throw new Error(marksError.message);
  if (eventsError) throw new Error(eventsError.message);

  const byMonth = new Map<string, DutyMonthCount>(
    monthKeys.map((month) => [month, { month, present: 0, absent: 0 }]),
  );
  for (const mark of (marks ?? []) as Array<{ attendance_date: string; status: string }>) {
    const bucket = byMonth.get(mark.attendance_date.slice(0, 7));
    if (!bucket) continue;
    if (mark.status === 'present') bucket.present += 1;
    else bucket.absent += 1;
  }
  const eventNameById = new Map(
    (musterEvents ?? []).map((event) => [event.id, event.event_name]),
  );
  return {
    guardId: guard.id,
    homeGuardCode: guard.home_guard_code,
    divisionId: guard.division_id,
    divisionName: guard.attendance_divisions?.[0]?.name ?? '',
    dateOfBirth: guard.date_of_birth,
    joiningDate: guard.joining_date,
    months: monthKeys.map((month) => byMonth.get(month)!),
    events: ((marks ?? []) as Array<{ event_id: string | null; attendance_date: string; status: string }>)
      .map((mark) => ({
        date: mark.attendance_date,
        eventId: mark.event_id,
        eventName: mark.event_id ? eventNameById.get(mark.event_id) ?? null : null,
        status: mark.status === 'absent' ? 'absent' as const : 'present' as const,
      }))
      .sort((a, b) => b.date.localeCompare(a.date) || (a.eventName ?? '').localeCompare(b.eventName ?? '')),
  };
}

export async function saveGuardProfileDates(
  guardId: string,
  dateOfBirth: string,
  joiningDate: string,
) {
  const isValidDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const parsed = new Date(year, month - 1, day);
    return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
  };
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (!isValidDate(dateOfBirth) || !isValidDate(joiningDate)) {
    throw new Error('Enter valid birth and joining dates.');
  }
  if (dateOfBirth > joiningDate || joiningDate > todayKey) {
    throw new Error('Joining date must be on or after the date of birth and cannot be in the future.');
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('home_guard_roster')
    .update({ date_of_birth: dateOfBirth, joining_date: joiningDate })
    .eq('id', guardId)
    .select('id')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('The Home Guard dates could not be saved.');
}

export async function loadAttendanceReport(from: string, to: string) {
  const supabase = createClient();
  const [divisions, roster] = await Promise.all([
    supabase.from('attendance_divisions').select('id, code, name').order('name'),
    supabase.from('home_guard_roster').select('id, division_id, full_name, home_guard_code').eq('is_active', true).order('full_name'),
  ]);
  const error = divisions.error || roster.error;
  if (error) throw new Error(error.message);
  const marks: Array<Pick<DailyMark, 'id' | 'guard_id' | 'division_id' | 'attendance_date' | 'status'>> = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await supabase
      .from('daily_attendance')
      .select('id, guard_id, division_id, attendance_date, status')
      .gte('attendance_date', from)
      .lte('attendance_date', to)
      .order('attendance_date', { ascending: false })
      .range(offset, offset + 999);
    if (page.error) throw new Error(page.error.message);
    const rows = page.data ?? [];
    marks.push(...(rows as typeof marks));
    if (rows.length < 1000) break;
  }
  return {
    divisions: (divisions.data ?? []) as AttendanceDivision[],
    roster: (roster.data ?? []) as Pick<RosterGuard, 'id' | 'division_id' | 'full_name' | 'home_guard_code'>[],
    marks,
  };
}

export async function filePersonnelReport(input: {
  guardId: string;
  divisionId: string;
  category: string;
  description: string;
  evidencePhoto: string;
  eventName: string;
  eventDate: string;
}) {
  if (!input.evidencePhoto) throw new Error('Attach a memo photo before filing the report.');
  if (!input.eventName.trim()) throw new Error('Enter the event this report is about.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.eventDate)) throw new Error('Enter a valid event date.');

  const supabase = createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error('Please sign in again to file a report.');

  const { error } = await supabase.from('personnel_reports').insert({
    filed_by: authData.user.id,
    guard_id: input.guardId,
    division_id: input.divisionId,
    category: input.category,
    description: input.description.trim(),
    evidence_photo: input.evidencePhoto,
    event_name: input.eventName.trim(),
    event_date: input.eventDate,
  });

  if (error) throw new Error(error.message);
}

export async function loadGuardMemoCount(guardId: string, phone?: string): Promise<number> {
  const supabase = createClient();
  let count = 0;
  try {
    const { data: pReports, error: pErr } = await supabase
      .from('personnel_reports')
      .select('id')
      .eq('guard_id', guardId);
    if (!pErr && pReports) count += pReports.length;

    if (phone) {
      const digits = phone.replace(/\D/g, '');
      if (digits.length >= 10) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id')
          .like('phone', `%${digits.slice(-10)}%`);
        if (profiles && profiles.length > 0) {
          const { data: gReports } = await supabase
            .from('guard_reports')
            .select('id')
            .eq('subject_id', profiles[0].id);
          if (gReports) count += gReports.length;
        }
      }
    }
  } catch {
    // Ignore error
  }
  return count;
}

export interface GuardPersonnelMemo {
  id: string;
  division_id: string;
  event_name: string | null;
  event_date: string | null;
  created_at: string;
}

export async function loadGuardPersonnelMemos(guardId: string): Promise<GuardPersonnelMemo[]> {
  const { data, error } = await createClient()
    .from('personnel_reports')
    .select('id,division_id,event_name,event_date,created_at')
    .eq('guard_id', guardId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as GuardPersonnelMemo[];
}

export async function addMusterEventEvidencePhoto(
  eventId: string,
  photoUrl: string,
): Promise<string[]> {
  const supabase = createClient();
  const { data: existing, error: existingError } = await supabase
    .from('muster_events')
    .select('evidence_photos')
    .eq('id', eventId)
    .single();
  if (existingError) throw new Error(describeEvidencePhotoError(existingError));

  const currentPhotos = ((existing?.evidence_photos as string[] | null) ?? []);
  const updatedPhotos = [...currentPhotos, photoUrl];

  const { error } = await supabase
    .from('muster_events')
    .update({ evidence_photos: updatedPhotos, updated_at: new Date().toISOString() })
    .eq('id', eventId);

  if (error) throw new Error(describeEvidencePhotoError(error));
  return updatedPhotos;
}

export async function removeMusterEventEvidencePhoto(
  eventId: string,
  index: number,
): Promise<string[]> {
  const supabase = createClient();
  const { data: existing, error: existingError } = await supabase
    .from('muster_events')
    .select('evidence_photos')
    .eq('id', eventId)
    .single();
  if (existingError) throw new Error(describeEvidencePhotoError(existingError));

  const currentPhotos = ((existing?.evidence_photos as string[] | null) ?? []);
  const updatedPhotos = currentPhotos.filter((_, i) => i !== index);

  const { error } = await supabase
    .from('muster_events')
    .update({ evidence_photos: updatedPhotos, updated_at: new Date().toISOString() })
    .eq('id', eventId);

  if (error) throw new Error(describeEvidencePhotoError(error));
  return updatedPhotos;
}

function describeEvidencePhotoError(error: { code?: string; message: string }) {
  if (error.code === 'PGRST204' || error.message.toLowerCase().includes('evidence_photos')) {
    return 'Event photo storage is not enabled in Supabase yet. Apply 20261108000001_add_evidence_photos.sql, then retry.';
  }
  return error.message;
}

export async function saveGuardPhotoEvidence(
  guardId: string,
  divisionId: string,
  date: string,
  eventId: string,
  photoUrl: string,
) {
  const supabase = createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error('Please sign in again to save photo evidence.');

  const { error } = await supabase.from('daily_attendance').upsert(
    {
      guard_id: guardId,
      division_id: divisionId,
      event_id: eventId,
      attendance_date: date,
      status: 'present',
      photo_url: photoUrl,
      marked_by: authData.user.id,
      marked_at: new Date().toISOString(),
    },
    { onConflict: 'guard_id,event_id' },
  );
  if (error) throw new Error(error.message);
}

export function compressImage(file: File, maxWidth = 1200, maxHeight = 1200, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Failed to process image file.'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}


