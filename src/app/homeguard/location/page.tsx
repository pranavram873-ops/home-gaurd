'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useLiveQuery } from '@/lib/hooks/useLiveQuery';
import { GeofenceMap } from '@/components/maps/GeofenceMap';
import { listDutyAssignments } from '@/lib/services/assignmentService';
import { recordCheckIn } from '@/lib/services/attendanceService';
import { useAuth } from '@/lib/auth/authContext';
import { calculateHaversineDistance } from '@/lib/utils';
import type { DutyAssignment } from '@/types';
import { Icon } from '@/components/ui/Icon';

/** `duty_assignments.start_time` is a Postgres TIME, so 'HH:MM:SS'. */
function clock(value: string | null | undefined): string {
  return value ? value.slice(0, 5) : '--:--';
}

/** A plain 'YYYY-MM-DD' for the guard's own calendar, matching the duty rows. */
function today(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Duties a stamp can be claimed against: today or later, and not already
 * finished. Ordered soonest first so a guard's next shift is the default.
 */
function eligibleDuties(duties: DutyAssignment[]): DutyAssignment[] {
  const date = today();
  return duties
    .filter(
      (d) =>
        d.duty_date.slice(0, 10) >= date &&
        d.status !== 'completed' &&
        d.status !== 'cancelled' &&
        d.location,
    )
    .sort((a, b) =>
      `${a.duty_date} ${a.start_time}`.localeCompare(`${b.duty_date} ${b.start_time}`),
    );
}

export default function HomeGuardLocationPage() {
  const { user } = useAuth();
  const userId = user?.id || null;

  const dutiesQuery = useLiveQuery<DutyAssignment[]>(
    () => (userId ? listDutyAssignments({ personnelId: userId }) : Promise.resolve({ data: [], error: null })),
    userId ?? 'no-user',
  );

  const duties = useMemo(() => eligibleDuties(dutiesQuery.data ?? []), [dutiesQuery.data]);

  // A guard working two posts today must be able to choose which one they are
  // standing at, so the selection is state rather than "the first row".
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeDuty = duties.find((d) => d.id === selectedId) ?? duties[0] ?? null;
  const location = activeDuty?.location ?? null;
  const locationId = location?.id ?? null;

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultMsg, setResultMsg] = useState<{ success: boolean; text: string } | null>(null);

  // Discards a ping that arrives after the guard has moved on to another post.
  const requestRef = useRef(0);

  // Function to acquire GPS coordinates
  const acquireLocation = useCallback(() => {
    const token = (requestRef.current += 1);
    setIsLocating(true);
    setLocError(null);
    setResultMsg(null);

    if (!navigator.geolocation) {
      setLocError('Geolocation is not supported by your mobile browser. Please use Chrome or Safari.');
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (token !== requestRef.current) return;
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setAccuracy(Math.round(pos.coords.accuracy));
        setIsLocating(false);
      },
      (err) => {
        if (token !== requestRef.current) return;
        // There is deliberately no fallback here. A check-in is evidence of
        // presence, so the browser may not invent coordinates when the guard
        // declines the permission prompt — they have to allow location access.
        setCoords(null);
        setAccuracy(null);
        setIsLocating(false);
        setLocError(
          err.code === err.PERMISSION_DENIED
            ? 'Location access is required to stamp muster. Allow it for this site, then refresh your coordinates.'
            : 'Could not read GPS. Move somewhere with a clearer view of the sky and refresh your coordinates.',
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }, []);

  // A different post means a different perimeter, so the old ping is dropped and
  // a fresh one is requested.
  useEffect(() => {
    setCoords(null);
    setAccuracy(null);
    if (locationId) acquireLocation();
  }, [locationId, acquireLocation]);

  // Compute live distance, for the display only. The server makes the finding.
  const currentDistance =
    coords && location
      ? calculateHaversineDistance(coords.lat, coords.lng, location.latitude, location.longitude)
      : null;

  const isWithin = currentDistance !== null && location ? currentDistance <= location.radius_meters : false;

  const handleAttendance = async (eventType: 'check_in' | 'check_out') => {
    if (!coords || !location || !activeDuty) {
      setLocError('Please allow location access and acquire your coordinates before submitting a muster stamp.');
      return;
    }

    setIsSubmitting(true);
    setResultMsg(null);

    const { data, error } = await recordCheckIn({
      location_id: location.id,
      duty_assignment_id: activeDuty.id,
      latitude: coords.lat,
      longitude: coords.lng,
      event_type: eventType,
      device_info: `Mobile Browser (Accuracy: ${accuracy ?? 'unknown'}m)`,
    });

    setIsSubmitting(false);

    if (error) {
      setResultMsg({ success: false, text: error });
      return;
    }

    setResultMsg({ success: data!.isWithinGeofence, text: data!.message });
    // The duty row may have just moved to in_progress or completed, so the
    // roster behind this screen is refetched rather than patched by hand.
    void dutiesQuery.refresh();
  };

  return (
    <DashboardLayout
      title="Biometric & GPS Muster Verification"
      subtitle="Tamil Nadu Home Guards • Geofenced Duty Attendance"
    >
      <div className="max-w-4xl mx-auto flex flex-col gap-6">
        {/* Geofence Notice Banner */}
        <div className="p-4 rounded-xl bg-primary-fixed border border-outline-variant text-on-primary-fixed text-xs flex items-start gap-3">
          <Icon icon="verified_user" size={20} className="text-primary shrink-0 mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <span className="font-bold">Official Biometric & Geofence Policy</span>
            <p className="text-on-surface-variant leading-relaxed">
              In accordance with State Home Guard Regulations, duty attendance must be stamped within the
              authorized perimeter radius ({location?.radius_meters ?? 150}m) of your assigned sector post. Your
              position is read only when you press the button; background tracking is never performed.
            </p>
          </div>
        </div>

        {dutiesQuery.loading ? (
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-xs p-8 flex items-center justify-center gap-2 text-xs text-on-surface-variant">
            <Icon icon="sync" size={16} className="animate-spin" />
            Loading your duty roster...
          </div>
        ) : dutiesQuery.error ? (
          <div className="p-4 rounded-xl bg-error-container border border-error-container text-on-error-container text-xs flex items-start gap-3">
            <Icon icon="warning" size={20} className="text-on-error-container shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Could not load your duties</span>
              <p className="mt-0.5">{dutiesQuery.error}</p>
            </div>
          </div>
        ) : !activeDuty || !location ? (
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-xs p-8 text-center flex flex-col gap-2">
            <Icon icon="location_on" size={24} className="text-outline mx-auto" />
            <span className="text-sm font-bold text-on-surface-variant">No duty is scheduled for check-in</span>
            <p className="text-xs text-on-surface-variant max-w-md mx-auto">
              Muster stamps are tied to a rostered post. Once your supervising officer assigns you a duty on
              today or a future date, that post and its geofence appear here.
            </p>
          </div>
        ) : (
          <>
            {duties.length > 1 && (
              <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-xs p-3 flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Select post for this stamp
                </span>
                {duties.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setSelectedId(d.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                      d.id === activeDuty.id
                        ? 'bg-primary border-outline-variant text-on-primary'
                        : 'bg-surface-container-lowest border-outline-variant text-on-surface-variant hover:bg-surface-container-low'
                    }`}
                  >
                    {d.location?.name} • {clock(d.start_time)}
                  </button>
                ))}
              </div>
            )}

            {/* Assigned Post Card */}
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-xs p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between pb-3 border-b border-outline-variant">
                <div className="flex items-center gap-2">
                  <Icon icon="location_on" size={20} className="text-primary" />
                  <h3 className="text-sm font-bold text-on-surface">Assigned Duty Post</h3>
                </div>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-tertiary-fixed text-on-tertiary-fixed-variant">
                  Active Geofence
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-base font-bold text-on-surface">{location.name}</span>
                  <p className="text-xs text-on-surface-variant">{location.address}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs font-mono text-on-surface-variant">
                    <span>Lat: {location.latitude}</span>
                    <span>•</span>
                    <span>Lng: {location.longitude}</span>
                  </div>
                </div>

                <div className="flex flex-col justify-center p-3 rounded-lg bg-surface-container-low border border-outline-variant text-xs gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-on-surface-variant font-medium">Permitted Radius:</span>
                    <span className="font-bold text-on-surface">{location.radius_meters} meters</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-on-surface-variant font-medium">Duty Assignment:</span>
                    <span className="font-bold text-primary truncate max-w-[200px]">{activeDuty.title}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-on-surface-variant font-medium">Duty Hours:</span>
                    <span className="font-bold text-on-surface font-mono">
                      {clock(activeDuty.start_time)} - {clock(activeDuty.end_time)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-on-surface-variant font-medium">Duty Date:</span>
                    <span className="font-bold text-on-surface font-mono">{activeDuty.duty_date.slice(0, 10)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* GPS Live Coordinates & Map Visualization */}
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-xs overflow-hidden flex flex-col">
              <div className="p-4 border-b border-outline-variant flex items-center justify-between bg-surface-container-low">
                <div className="flex items-center gap-2">
                  <Icon icon="explore" size={16} className="text-primary" />
                  <span className="text-xs font-bold text-on-surface uppercase tracking-wider">
                    GPS Position & Geofence Perimeter
                  </span>
                </div>
                <button
                  onClick={acquireLocation}
                  disabled={isLocating}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low text-xs font-semibold text-on-surface-variant transition-colors cursor-pointer"
                >
                  <Icon icon="refresh" size={14} className={isLocating ? 'animate-spin' : ''} />
                  <span>Refresh Coordinates</span>
                </button>
              </div>

              {/* Interactive Visual Map Representation */}
              <div className="relative border-b border-outline-variant">
                <GeofenceMap
                  post={{
                    name: location.name,
                    latitude: location.latitude,
                    longitude: location.longitude,
                    radiusMeters: location.radius_meters,
                  }}
                  position={coords ? { lat: coords.lat, lng: coords.lng } : null}
                  heightClass="h-64"
                />

                {/* The finding the map is being read for: is this fix inside the
                    authorized perimeter? The server still makes it; this is the
                    guard's chance to check before pressing the button. */}
                {currentDistance !== null && (
                  <div
                    className={`pointer-events-none absolute top-3 left-3 px-2.5 py-1.5 rounded-lg border text-[13px] font-bold shadow-xs ${
                      isWithin
                        ? 'bg-tertiary-fixed border-outline-variant text-on-tertiary-fixed-variant'
                        : 'bg-secondary-fixed border-secondary-fixed text-on-secondary-fixed-variant'
                    }`}
                  >
                    {isWithin ? 'Inside perimeter' : 'Outside perimeter'} · {currentDistance}m from post centre
                  </div>
                )}

                {accuracy !== null && (
                  <div className="pointer-events-none absolute bottom-3 right-3 px-2 py-1 rounded-lg bg-surface-container-lowest/90 border border-outline-variant text-xs font-mono text-on-surface-variant shadow-xs">
                    GPS accuracy ±{accuracy}m
                  </div>
                )}
              </div>

              {/* Position telemetry bar */}
              <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-surface-container-lowest">
                <div className="p-2.5 rounded-lg bg-surface-container-low border border-outline-variant">
                  <span className="text-xs text-on-surface-variant font-bold uppercase block">Current Device Position</span>
                  <span className="font-mono text-on-surface font-semibold block mt-0.5">
                    {coords ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : 'Acquiring GPS...'}
                  </span>
                  <span className="text-xs text-on-surface-variant mt-0.5 block">
                    Accuracy: ±{accuracy !== null ? accuracy : '—'} meters
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-surface-container-low border border-outline-variant">
                  <span className="text-xs text-outline font-bold uppercase block">Distance to Post</span>
                  <span className="font-mono text-sm font-bold text-primary block mt-0.5">
                    {currentDistance !== null ? `${currentDistance} meters` : 'Calculating...'}
                  </span>
                  <span className="text-xs text-on-surface-variant mt-0.5 block">
                    Allowed: &lt; {location.radius_meters}m
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-surface-container-low border border-outline-variant">
                  <span className="text-xs text-outline font-bold uppercase block">Perimeter Compliance</span>
                  <div className="mt-0.5">
                    {isWithin ? (
                      <span className="inline-flex items-center gap-1 font-bold text-on-tertiary-fixed-variant bg-tertiary-fixed px-2 py-0.5 rounded text-xs">
                        <Icon icon="check_circle" size={14} /> Inside Allowed Zone
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-bold text-on-error-container bg-error-container px-2 py-0.5 rounded text-xs">
                        <Icon icon="warning" size={14} /> Outside Perimeter
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Location permission failure, stated plainly */}
            {locError && (
              <div className="p-4 rounded-xl bg-error-container border border-error-container text-on-error-container text-xs flex items-start gap-3">
                <Icon icon="warning" size={20} className="text-on-error-container shrink-0 mt-0.5" />
                <p className="leading-relaxed">{locError}</p>
              </div>
            )}

            {/* Execution Result Box */}
            {resultMsg && (
              <div
                className={`p-4 rounded-xl border text-xs flex items-start gap-3 ${
                  resultMsg.success
                    ? 'bg-tertiary-fixed border-outline-variant text-on-tertiary-fixed-variant'
                    : 'bg-secondary-fixed border-secondary-fixed text-on-secondary-fixed-variant'
                }`}
              >
                {resultMsg.success ? (
                  <Icon icon="check_circle" size={20} className="text-on-tertiary-container shrink-0 mt-0.5" />
                ) : (
                  <Icon icon="warning" size={20} className="text-secondary shrink-0 mt-0.5" />
                )}
                <div>
                  <span className="font-bold block">
                    {resultMsg.success ? 'Muster Stamp Recorded' : 'Geofence Notice'}
                  </span>
                  <p className="mt-0.5 leading-relaxed">{resultMsg.text}</p>
                </div>
              </div>
            )}

            {/* Check-In and Check-Out Action Panel */}
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex flex-col text-xs text-on-surface-variant">
                <span className="font-bold text-on-surface text-sm">Submit Operational Stamp</span>
                <span>Click below to record your arrival or departure for this scheduled shift.</span>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={() => void handleAttendance('check_in')}
                  disabled={isSubmitting || !coords}
                  className="flex-1 sm:flex-none px-6 py-2.5 rounded-lg bg-on-tertiary-container hover:bg-on-tertiary-container text-on-primary font-bold text-xs shadow-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <Icon icon="sync" size={16} className="animate-spin" />
                  ) : (
                    <Icon icon="check_circle" size={16} />
                  )}
                  <span>Duty Check-In</span>
                </button>

                <button
                  onClick={() => void handleAttendance('check_out')}
                  disabled={isSubmitting || !coords}
                  className="flex-1 sm:flex-none px-6 py-2.5 rounded-lg bg-surface-container hover:bg-surface-container text-on-surface font-bold text-xs shadow-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <Icon icon="sync" size={16} className="animate-spin" />
                  ) : (
                    <Icon icon="schedule" size={16} />
                  )}
                  <span>Duty Check-Out</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
