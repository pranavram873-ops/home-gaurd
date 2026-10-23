import { NextRequest, NextResponse } from 'next/server';
import { checkInSchema } from '@/lib/validation';
import { dataService } from '@/lib/services/dataService';
import { createClient } from '@/lib/supabase/server';
import { isDemoModeEnabled } from '@/lib/supabase/env';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = checkInSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid attendance payload', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { location_id, latitude, longitude, event_type, duty_assignment_id, device_info, remarks } =
      validation.data;

    // Identity must come from the verified session, never from a cookie the
    // caller can set. Demo mode is the only place a demo id is trusted, and it
    // cannot be reached from a production build.
    let userId: string | null = null;

    if (isDemoModeEnabled()) {
      userId = request.cookies.get('tnhg_demo_user_id')?.value || 'usr-guard-1';
    } else {
      try {
        const supabase = await createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        userId = user?.id ?? null;
      } catch {
        userId = null;
      }

      if (!userId) {
        return NextResponse.json({ error: 'Authentication required to record attendance.' }, { status: 401 });
      }
    }

    // Attendance is still written to the in-memory service; persisting it into
    // the Supabase `attendance_events` table is a separate increment.
    const result = dataService.recordAttendance({
      userId,
      dutyAssignmentId: duty_assignment_id || null,
      locationId: location_id,
      latitude,
      longitude,
      eventType: event_type,
      deviceInfo: device_info,
      remarks,
    });

    return NextResponse.json(result, { status: result.success ? 200 : 422 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error recording attendance';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
