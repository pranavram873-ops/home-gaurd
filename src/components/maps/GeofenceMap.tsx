'use client';

import React, { useEffect } from 'react';
import { Circle, GestureHandling, Map, Marker, Polyline, useMap } from '@vis.gl/react-google-maps';
import { MapShell } from './MapShell';
import { mapsMapIdProp } from '@/lib/maps/config';

export interface MapPoint {
  lat: number;
  lng: number;
}

interface GeofenceMapProps {
  /** The post whose perimeter is on the map. */
  post: {
    name: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
  };
  /** The viewer's own fix, drawn as a GPS dot with the distance spanned. */
  position?: MapPoint | null;
  /**
   * The remaining posts, so a command map shows the sector rather than one
   * isolated point. Clicking one is how the operator selects it.
   */
  others?: Array<{ id: string; name: string; latitude: number; longitude: number }>;
  onSelect?: (id: string) => void;
  heightClass?: string;
}

/**
 * A duty post and its authorized geofence, drawn to scale on real map tiles:
 * the radius is the same figure the server checks a muster stamp against, so
 * what an operator sees here is what the Haversine calculation enforces.
 */
export function GeofenceMap({
  post,
  position = null,
  others,
  onSelect,
  heightClass = 'h-96',
}: GeofenceMapProps) {
  const center: MapPoint = { lat: post.latitude, lng: post.longitude };

  return (
    <MapShell
      label={post.name}
      summary={`${post.latitude.toFixed(5)}° N, ${post.longitude.toFixed(5)}° E · ${post.radiusMeters} m perimeter`}
      heightClass={heightClass}
    >
      <Map
        // A controlled center only moves the camera when the value actually
        // changes, so an operator's own panning is never fought by a re-render.
        id="geofence-map"
        center={center}
        zoom={15}
        mapId={mapsMapIdProp()}
        gestureHandling={GestureHandling.COOPERATIVE}
        mapTypeControl
        // A perimeter is a circle: rotating the view cannot reveal anything a
        // pan cannot, and a tilted map makes the radius harder to read.
        rotateControl={false}
        streetViewControl={false}
        clickableIcons={false}
        className="h-full w-full"
      >
        <Circle
          center={center}
          radius={post.radiusMeters}
          clickable={false}
          strokeColor="#1d4ed8"
          strokeOpacity={0.9}
          strokeWeight={2}
          fillColor="#3b82f6"
          fillOpacity={0.14}
        />

        <Marker position={center} title={post.name} label="POST" />

        {others?.map((loc) => (
          <Marker
            key={loc.id}
            position={{ lat: loc.latitude, lng: loc.longitude }}
            title={loc.name}
            // A smaller, greyed pin keeps the selected post the loudest thing
            // on the sheet without hiding the other posts behind it.
            opacity={0.55}
            onClick={() => onSelect?.(loc.id)}
          />
        ))}

        {position && (
          <>
            <Polyline
              path={[center, position]}
              clickable={false}
              strokeColor="#0f172a"
              strokeOpacity={0.45}
              strokeWeight={2}
            />
            <FixMarker position={position} />
            <FitToPostAndFix center={center} position={position} />
          </>
        )}
      </Map>
    </MapShell>
  );
}

/**
 * The guard's own fix: a green GPS dot rather than a pin, because a pin reads
 * as another post. The circle is written as an SVG path instead of
 * `google.maps.SymbolPath.CIRCLE` so this element can be created before the
 * Maps script has finished loading - the global does not exist yet at that
 * point, and touching it during render would throw.
 */
function FixMarker({ position }: { position: MapPoint }) {
  return (
    <Marker
      position={position}
      title="Your position"
      label="YOU"
      icon={{
        path: 'M 0,0 m -9,0 a 9,9 0 1,0 18,0 a 9,9 0 1,0 -18,0',
        fillColor: '#059669',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 3,
      }}
    />
  );
}

/**
 * When a fix is in, the useful view is the one holding both the post and the
 * guard. Fitting is skipped while they coincide, because `fitBounds` on a
 * degenerate box zooms to the maximum and loses the perimeter.
 *
 * The dependencies are the four numbers rather than the two objects: both are
 * rebuilt on every render, and depending on them would snatch the view back
 * whenever the operator had panned elsewhere.
 */
function FitToPostAndFix({ center, position }: { center: MapPoint; position: MapPoint }) {
  const map = useMap();
  const { lat: cl, lng: cn } = center;
  const { lat: pl, lng: pn } = position;

  useEffect(() => {
    if (!map) return;

    const sameSpot = Math.abs(cl - pl) < 0.00005 && Math.abs(cn - pn) < 0.00005;
    if (sameSpot) return;

    const bounds = new google.maps.LatLngBounds();
    bounds.extend({ lat: cl, lng: cn });
    bounds.extend({ lat: pl, lng: pn });
    map.fitBounds(bounds, 56);
  }, [map, cl, cn, pl, pn]);

  return null;
}
