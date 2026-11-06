'use client';

import { createClient } from '@/lib/supabase/client';

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
}

export interface DailyMark {
  id: string;
  guard_id: string;
  division_id: string;
  attendance_date: string;
  status: 'present' | 'absent';
  marked_at: string;
}

export async function loadAttendancePage(divisionId: string, date: string) {
  const supabase = createClient();
  const [divisions, roster, marks] = await Promise.all([
    supabase.from('attendance_divisions').select('id, code, name').order('name'),
    divisionId
      ? supabase
          .from('home_guard_roster')
          .select('id, division_id, full_name, phone, home_guard_code, is_active')
          .eq('division_id', divisionId)
          .eq('is_active', true)
          .order('full_name')
      : Promise.resolve({ data: [], error: null }),
    divisionId
      ? supabase
          .from('daily_attendance')
          .select('id, guard_id, division_id, attendance_date, status, marked_at')
          .eq('division_id', divisionId)
          .eq('attendance_date', date)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const error = divisions.error || roster.error || marks.error;
  if (error) throw new Error(error.message);
  return {
    divisions: (divisions.data ?? []) as AttendanceDivision[],
    roster: (roster.data ?? []) as RosterGuard[],
    marks: (marks.data ?? []) as DailyMark[],
  };
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
 * A division-day muster summary for the admin events list. One row per
 * (division, date) that has attendance activity in the month.
 */
export interface AttendanceEventSummary {
  /** Composite key `${divisionId}.${date}` used to route to the detail screen. */
  id: string;
  divisionId: string;
  divisionName: string;
  date: string;
  presentCount: number;
  absentCount: number;
  sanctionedCount: number;
  markedCount: number;
  /** True when the muster day is still open for marking (today or later). */
  isOpen: boolean;
}

export function attendanceEventId(divisionId: string, date: string) {
  return `${divisionId}.${date}`;
}

export function parseAttendanceEventId(id: string): { divisionId: string; date: string } | null {
  const separator = id.lastIndexOf('.');
  if (separator === -1) return null;
  const divisionId = id.slice(0, separator);
  const date = id.slice(separator + 1);
  if (!divisionId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return { divisionId, date };
}

/**
 * Every division-day with at least one mark in the given month (`YYYY-MM`),
 * narrowed to one division when `divisionId` is supplied. Sanctioned strength
 * is the division's active roster, the same number the incharge works against.
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

  const [divisions, roster, marks] = await Promise.all([
    supabase.from('attendance_divisions').select('id, code, name').order('name'),
    supabase.from('home_guard_roster').select('id, division_id').eq('is_active', true),
    supabase
      .from('daily_attendance')
      .select('guard_id, division_id, attendance_date, status')
      .gte('attendance_date', from)
      .lte('attendance_date', to)
      .order('attendance_date', { ascending: false }),
  ]);
  const error = divisions.error || roster.error || marks.error;
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
  const buckets = new Map<string, { present: number; absent: number }>();
  for (const mark of (marks.data ?? []) as Array<{ division_id: string; attendance_date: string; status: string }>) {
    if (divisionId && mark.division_id !== divisionId) continue;
    const key = attendanceEventId(mark.division_id, mark.attendance_date);
    const bucket = buckets.get(key) ?? { present: 0, absent: 0 };
    if (mark.status === 'present') bucket.present += 1;
    else bucket.absent += 1;
    buckets.set(key, bucket);
  }

  const summaries: AttendanceEventSummary[] = [];
  for (const [id, bucket] of buckets) {
    const parsed = parseAttendanceEventId(id);
    if (!parsed) continue;
    const markedCount = bucket.present + bucket.absent;
    summaries.push({
      id,
      divisionId: parsed.divisionId,
      divisionName: nameById.get(parsed.divisionId) ?? 'Unknown division',
      date: parsed.date,
      presentCount: bucket.present,
      absentCount: bucket.absent,
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
  status: 'present' | 'absent',
) {
  const supabase = createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error('Please sign in again to save attendance.');
  const { error } = await supabase.from('daily_attendance').upsert(
    {
      guard_id: guardId,
      division_id: divisionId,
      attendance_date: date,
      status,
      marked_by: authData.user.id,
      marked_at: new Date().toISOString(),
    },
    { onConflict: 'guard_id,attendance_date' },
  );
  if (error) throw new Error(error.message);
}

export async function addRosterGuard(input: {
  full_name: string;
  phone: string;
  home_guard_code: string;
  division_id: string;
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
  homeGuardCode: string;
  divisionName: string;
  months: DutyMonthCount[];
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
    .select('id, home_guard_code, attendance_divisions(name)')
    .like('phone', `%${tail}%`)
    .eq('is_active', true);
  if (guardsError) throw new Error(guardsError.message);
  const guard = (guards ?? [])[0] as
    | { id: string; home_guard_code: string; attendance_divisions: { name: string }[] }
    | undefined;
  if (!guard) return null;

  // Six `YYYY-MM` buckets, newest first.
  const now = new Date();
  const monthKeys: string[] = [];
  for (let back = 0; back < 6; back += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
    monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const { data: marks, error: marksError } = await supabase
    .from('daily_attendance')
    .select('attendance_date, status')
    .eq('guard_id', guard.id)
    .gte('attendance_date', `${monthKeys[5]}-01`);
  if (marksError) throw new Error(marksError.message);

  const byMonth = new Map<string, DutyMonthCount>(
    monthKeys.map((month) => [month, { month, present: 0, absent: 0 }]),
  );
  for (const mark of (marks ?? []) as Array<{ attendance_date: string; status: string }>) {
    const bucket = byMonth.get(mark.attendance_date.slice(0, 7));
    if (!bucket) continue;
    if (mark.status === 'present') bucket.present += 1;
    else bucket.absent += 1;
  }
  return {
    homeGuardCode: guard.home_guard_code,
    divisionName: guard.attendance_divisions?.[0]?.name ?? '',
    months: monthKeys.map((month) => byMonth.get(month)!),
  };
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
