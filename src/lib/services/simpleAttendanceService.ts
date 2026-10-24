'use client';

import { createClient } from '@/lib/supabase/client';

export interface AttendanceDivision {
  id: string;
  code: string;
  name: string;
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
