import { NextRequest, NextResponse } from 'next/server';
import { checkInSchema } from '@/lib/validation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, getSupabaseSecretKey } from '@/lib/supabase/admin';
import { calculateHaversineDistance } from '@/lib/utils';

export const runtime = 'nodejs';

/**
 * Two stamps of the same kind inside this window are one arrival, not two. The
 * rule used to live in the in-memory service; it belongs on the server, because
 * a browser can simply choose not to run it.
 */
const DUPLICATE_WINDOW_MINUTES = 15;

interface PostRow {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
}

interface DutyRow {
  id: string;
  assigned_personnel_id: string;
  duty_date: string;
  status: string;
}

interface StampRow {
  event_type: 'check_in' | 'check_out';
  recorded_at: string;
}

/**
 * A duty belongs to the guard's calendar day, not the server's UTC day: a shift
 * stamped at 02:00 IST is still that date in Tamil Nadu even though UTC is
 * still the evening before. `en-CA` renders the ISO order we store.
 */
function currentDutyDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Geofenced muster stamp.
 *
 * Everything that decides the outcome happens here rather than in the browser:
 * the post's real coordinates and perimeter, the distance, the duplicate window
 * and the duty-status transition. The client reports only where it is.
 *
 * Reads and writes go through the session-bound client, so RLS still decides:
 * "Users insert own attendance" is what makes a forged `user_id` impossible, and
 * "Locations viewable by active authenticated" hides a retired post. The one
 * write RLS cannot express for a guard is the duty status flip — the update
 * policy on `duty_assignments` is admin-only — so that single statement uses the
 * service key, narrowed in code to the verified assignee's own row.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = checkInSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid attendance payload', details: validation.error.errors },
        { status: 400 },
      );
    }

    const { location_id, latitude, longitude, event_type, duty_assignment_id, device_info, remarks } =
      validation.data;

    // Identity comes from the verified session and from nothing else. A cookie
    // the caller controls is not evidence of who is stamping muster, and every
    // stamp here is a legal record.
    let supabase: Awaited<ReturnType<typeof createClient>>;
    let userId: string;

    try {
      supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        return NextResponse.json({ error: 'Authentication required to record attendance.' }, { status: 401 });
      }
      userId = user.id;
    } catch {
      return NextResponse.json({ error: 'Authentication required to record attendance.' }, { status: 401 });
    }

    // The post, as the database describes it. A guard asking about a post that
    // is retired, or that does not exist, gets the same answer: nothing.
    const { data: post } = await supabase
      .from('duty_locations')
      .select('id, name, latitude, longitude, radius_meters')
      .eq('id', location_id)
      .maybeSingle<PostRow>();

    if (!post) {
      return NextResponse.json(
        { error: 'That duty post is not available for check-in. Contact your supervising officer.' },
        { status: 404 },
      );
    }

    const distanceMeters = calculateHaversineDistance(latitude, longitude, post.latitude, post.longitude);
    const isWithinGeofence = distanceMeters <= post.radius_meters;

    // Duplicate window. Filtered by event type rather than "the last stamp of
    // any kind", so alternating in and out cannot bypass it.
    const { data: lastStamp } = await supabase
      .from('attendance_events')
      .select('event_type, recorded_at')
      .eq('user_id', userId)
      .eq('event_type', event_type)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle<StampRow>();

    if (lastStamp) {
      const minutesSince = (Date.now() - new Date(lastStamp.recorded_at).getTime()) / 60000;
      if (minutesSince >= 0 && minutesSince < DUPLICATE_WINDOW_MINUTES) {
        return NextResponse.json(
          {
            error: `Duplicate ${event_type === 'check_in' ? 'check-in' : 'check-out'} detected within ${DUPLICATE_WINDOW_MINUTES} minutes.`,
            distanceMeters,
            isWithinGeofence,
          },
          { status: 409 },
        );
      }
    }

    // The duty, if the stamp claims one. The select policy only returns it to
    // its assignee or an administrator, so a wrong id and someone else's id
    // both arrive here as `null`.
    let duty: DutyRow | null = null;

    if (duty_assignment_id) {
      const { data: found } = await supabase
        .from('duty_assignments')
        .select('id, assigned_personnel_id, duty_date, status')
        .eq('id', duty_assignment_id)
        .maybeSingle<DutyRow>();

      if (!found) {
        return NextResponse.json({ error: 'That duty assignment no longer exists.' }, { status: 404 });
      }
      if (found.assigned_personnel_id !== userId) {
        return NextResponse.json({ error: 'This duty is assigned to another guard.' }, { status: 403 });
      }
      duty = found;
    }

    const isTodayDuty = duty ? duty.duty_date.slice(0, 10) === currentDutyDate() : false;

    // The stamp itself, written under the guard's own session so RLS confirms
    // `user_id = auth.uid()`. `recorded_at` is left to the database default:
    // the server clock of the person holding the phone is not evidence.
    const { data: event, error: insertError } = await supabase
      .from('attendance_events')
      .insert({
        user_id: userId,
        duty_assignment_id: duty?.id ?? null,
        location_id: post.id,
        event_type,
        latitude,
        longitude,
        distance_meters: distanceMeters,
        is_within_geofence: isWithinGeofence,
        validation_status: isWithinGeofence ? 'verified' : 'flagged_distance',
        device_info: device_info?.trim() || 'Authorized Mobile Browser GPS',
        remarks:
          remarks?.trim() ||
          (isWithinGeofence
            ? 'Verified on-site check'
            : `Outside geofence perimeter by ${Math.max(0, distanceMeters - post.radius_meters)}m`),
      })
      .select('id')
      .maybeSingle<{ id: string }>();

    if (insertError || !event) {
      return NextResponse.json(
        { error: 'The muster stamp could not be recorded. Please retry from within the perimeter.' },
        { status: 500 },
      );
    }

    // Advance the duty. An arrival that fell outside the perimeter is a flag for
    // the supervisor to review, not an attendance, so it never starts a shift;
    // a departure closes the shift whatever the distance, because the guard was
    // on duty and is now leaving.
    const nextStatus =
      event_type === 'check_in'
        ? isWithinGeofence && duty?.status === 'scheduled'
          ? 'in_progress'
          : null
        : duty && duty.status !== 'completed' && duty.status !== 'cancelled'
          ? 'completed'
          : null;

    if (duty && nextStatus && isTodayDuty && getSupabaseSecretKey()) {
      try {
        const admin = createAdminClient();
        // The extra `assigned_personnel_id` filter keeps this true even if the
        // id in the request body were swapped for another guard's duty.
        const { error: dutyError } = await admin
          .from('duty_assignments')
          .update({ status: nextStatus, updated_at: new Date().toISOString() })
          .eq('id', duty.id)
          .eq('assigned_personnel_id', userId);

        if (dutyError) {
          console.error('Duty status was not advanced after a check-in:', dutyError.message);
        }
      } catch (err) {
        console.error('Duty status was not advanced after a check-in:', err);
      }
    }

    // The trail the mock kept, now in `audit_logs`. Its policy lets a user sign
    // an entry with their own id, so it goes through the same session client. A
    // failure here must not undo a stamp that is already on the register.
    const {
      data: { user: actor },
    } = await supabase.auth.getUser();

    await supabase.from('audit_logs').insert({
      actor_id: userId,
      actor_email: actor?.email ?? null,
      actor_role: null,
      action: isWithinGeofence ? `GEOFENCE_${event_type.toUpperCase()}_VERIFIED` : `GEOFENCE_${event_type.toUpperCase()}_OUTSIDE_PERIMETER`,
      target_type: 'attendance_event',
      target_id: event.id,
      details: { location: post.name, distanceMeters, allowedRadius: post.radius_meters },
    });

    return NextResponse.json(
      {
        success: isWithinGeofence,
        message: isWithinGeofence
          ? `${event_type === 'check_in' ? 'Check-in' : 'Check-out'} verified! You are inside the perimeter (${distanceMeters}m from post center).`
          : `Stamp recorded with a distance alert: you are ${distanceMeters}m from the post center (allowed radius: ${post.radius_meters}m).`,
        distanceMeters,
        isWithinGeofence,
      },
      { status: isWithinGeofence ? 200 : 422 },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error recording attendance';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
