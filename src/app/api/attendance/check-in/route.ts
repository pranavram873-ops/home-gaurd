import { NextRequest, NextResponse } from 'next/server';
import { checkInSchema } from '@/lib/validation';
import { dataService } from '@/lib/services/dataService';

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

    // Retrieve active user from cookie or session
    const userId = request.cookies.get('tnhg_demo_user_id')?.value || 'usr-guard-1';

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
