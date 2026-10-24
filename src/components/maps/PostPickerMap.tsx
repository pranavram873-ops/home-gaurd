'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Circle, GestureHandling, Map, Marker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { Loader2, MapPin, Search, X } from 'lucide-react';
import { MapShell } from './MapShell';
import { mapsMapIdProp } from '@/lib/maps/config';
import { MIN_SEARCH_LENGTH, searchPlaces, type GeoResult } from '@/lib/maps/geocode';
import type { MapPoint } from './GeofenceMap';

export interface PlacedPost {
  position: MapPoint;
  /** The address a search matched, when the pin arrived through the search box. */
  label?: string;
}

interface PostPickerMapProps {
  /** The coordinate the form currently holds. */
  position: MapPoint;
  /** Previewed live, so the perimeter is sized before it is filed. */
  radiusMeters: number;
  name?: string;
  onPlace: (placed: PlacedPost) => void;
  heightClass?: string;
}

/** Coordinates as stored by the API are carried to about a metre of precision. */
function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

function samePoint(a: MapPoint, b: MapPoint): boolean {
  return Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lng - b.lng) < 1e-6;
}

/**
 * The picker behind a new duty post: search the place, then fine-tune the pin by
 * dragging it or clicking the ground, and the coordinates land in the form. The
 * circle is the post's real perimeter, so the operator is choosing the area a
 * guard must stand inside, not a dot on a map.
 *
 * A coordinate the map produced itself never moves the camera. Re-centering on a
 * pin the operator has just dragged would slide the street they were aligning to
 * out from under the pointer; a searched coordinate does move it, because there
 * the operator is asking to be taken somewhere else.
 */
export function PostPickerMap({
  position,
  radiusMeters,
  name,
  onPlace,
  heightClass = 'h-72',
}: PostPickerMapProps) {
  const geocodingLibrary = useMapsLibrary('geocoding');
  const geocoder = useMemo(
    () => (geocodingLibrary ? new geocodingLibrary.Geocoder() : null),
    [geocodingLibrary],
  );
  // The last coordinate this map handed to the form. `CameraSync` compares
  // against it to tell a drag or click from a search result.
  const internalRef = useRef<MapPoint>(position);

  const commit = useCallback(
    (point: MapPoint) => {
      const rounded = { lat: round6(point.lat), lng: round6(point.lng) };
      internalRef.current = rounded;
      onPlace({ position: rounded });
    },
    [onPlace],
  );

  return (
    <div className="flex flex-col gap-2">
      {/* Above the map rather than floating over it, so a long result list is
          never clipped by the map's own overflow. */}
      <PostSearchBox
        geocoder={geocoder}
        onPicked={(result) =>
          onPlace({
            position: { lat: round6(result.lat), lng: round6(result.lng) },
            label: result.label,
          })
        }
      />

      <MapShell
        label={name?.trim() || 'New duty post'}
        summary={`${position.lat.toFixed(5)}° N, ${position.lng.toFixed(5)}° E · ${radiusMeters} m perimeter`}
        heightClass={heightClass}
      >
        <Map
          id="post-picker"
          defaultCenter={position}
          zoom={16}
          mapId={mapsMapIdProp()}
          gestureHandling={GestureHandling.COOPERATIVE}
          mapTypeControl
          // Pin dragging is done in plan view; a tilted map offsets the pointer
          // from the coordinate it is actually selecting.
          rotateControl={false}
          streetViewControl={false}
          clickableIcons={false}
          className="h-full w-full"
          onClick={(event) => {
            const point = event.detail.latLng;
            if (point) commit(point);
          }}
        >
          <Circle
            center={position}
            radius={radiusMeters}
            clickable={false}
            strokeColor="#1d4ed8"
            strokeOpacity={0.9}
            strokeWeight={2}
            fillColor="#3b82f6"
            fillOpacity={0.14}
          />

          <Marker
            position={position}
            title={name?.trim() || 'New duty post'}
            label="POST"
            draggable
            onDragEnd={(event) => {
              const point = event.latLng;
              if (point) commit({ lat: point.lat(), lng: point.lng() });
            }}
          />

          <CameraSync position={position} internal={internalRef} />
        </Map>
      </MapShell>
    </div>
  );
}

/**
 * Moves the camera for a coordinate that arrived from outside the map - a search
 * result - and stays still for one the map just produced.
 */
function CameraSync({
  position,
  internal,
}: {
  position: MapPoint;
  internal: React.RefObject<MapPoint>;
}) {
  const map = useMap();
  const { lat, lng } = position;

  useEffect(() => {
    if (!map) return;
    if (samePoint(internal.current, position)) return;

    internal.current = { lat, lng };
    map.panTo({ lat, lng });
  }, [map, lat, lng, position, internal]);

  return null;
}

/**
 * Type-ahead over Google Geocoding. Two pieces of state rather than one:
 * `query` is what the input shows, `term` is what is searched. Picking a result
 * rewrites the former but not the latter, so closing the list does not fire a
 * fresh search that immediately reopens it.
 */
function PostSearchBox({
  geocoder,
  onPicked,
}: {
  geocoder: google.maps.Geocoder | null;
  onPicked: (result: GeoResult) => void;
}) {
  const [query, setQuery] = useState('');
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const requestId = useRef(0);

  useEffect(() => {
    if (term.trim().length < MIN_SEARCH_LENGTH) {
      setResults([]);
      setBusy(false);
      setNotice(null);
      setOpen(false);
      return;
    }

    if (!geocoder) {
      setResults([]);
      setBusy(false);
      setOpen(false);
      setNotice('Google Maps search is unavailable. Check the Maps key and Geocoding API setup.');
      return;
    }

    setBusy(true);
    let cancelled = false;
    const currentRequest = ++requestId.current;

    // Wait for typing to settle and discard a stale result if another query
    // starts before Google replies.
    const timer = setTimeout(() => {
      searchPlaces(geocoder, term)
        .then((found) => {
          if (cancelled || currentRequest !== requestId.current) return;
          setBusy(false);
          setResults(found);
          setActive(0);
          setOpen(found.length > 0);
          setNotice(
            found.length ? null : 'Nothing matched that name. Try a landmark, town or district.',
          );
        })
        .catch(() => {
          if (cancelled || currentRequest !== requestId.current) return;
          setBusy(false);
          setResults([]);
          setOpen(false);
          // Search is a shortcut, never a requirement: the map below still takes
          // the post without search.
          setNotice(
            'Google search could not complete. You can still place the post by clicking the map.',
          );
        });
    }, 500);

    return () => {
      clearTimeout(timer);
      cancelled = true;
    };
  }, [term, geocoder]);

  const pick = (result: GeoResult) => {
    setQuery(result.label);
    setOpen(false);
    setNotice(null);
    onPicked(result);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }

    // The input lives inside the Add Post form, so Enter has to be handled here
    // whether or not a list is open: otherwise a stray Enter accepts nothing and
    // submits the post instead.
    if (event.key === 'Enter') {
      event.preventDefault();
      const chosen = open ? results[active] : undefined;
      if (chosen) pick(chosen);
      return;
    }

    if (!open || results.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => (index + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => (index - 1 + results.length) % results.length);
    }
  };

  return (
    <div className="relative z-30">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
      <input
        type="text"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setTerm(event.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (results.length > 0) setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        aria-label="Search for a place to site the duty post"
        placeholder="Search a town, landmark or beach…"
        className="w-full pl-8 pr-8 py-2 text-xs rounded-lg border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-800/25 focus:border-blue-800"
      />

      {busy ? (
        <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-blue-800" />
      ) : query ? (
        <button
          type="button"
          onClick={() => {
            setQuery('');
            setTerm('');
            setNotice(null);
          }}
          aria-label="Clear the search"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      ) : null}

      {open && results.length > 0 && (
        <ul className="absolute left-0 right-0 top-full mt-1 max-h-44 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg divide-y divide-slate-100">
          {results.map((result, index) => (
            <li key={result.id}>
              <button
                type="button"
                onMouseEnter={() => setActive(index)}
                onClick={() => pick(result)}
                className={`w-full text-left px-2.5 py-1.5 text-[11px] flex items-start gap-1.5 cursor-pointer ${
                  index === active ? 'bg-blue-50 text-blue-900' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <MapPin className="w-3 h-3 mt-0.5 shrink-0 text-blue-800" />
                <span className="leading-snug">{result.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {notice && (
        <p className="mt-1 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-[10px] leading-snug text-amber-900">
          {notice}
        </p>
      )}
    </div>
  );
}
