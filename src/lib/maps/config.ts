/**
 * Google Maps configuration.
 *
 * A Maps JavaScript API key is not a secret. It is compiled into the browser
 * bundle by Next.js (`NEXT_PUBLIC_*`) and is contained by HTTP-referrer
 * restrictions set in Google Cloud Console, exactly like the Supabase
 * publishable key. What it must never be is *assumed*: a project can be
 * deployed before the key exists, so every consumer of this module has to be
 * able to render an honest offline panel instead of an empty grey box.
 */

/** The key authorizing the Maps JavaScript API for this origin. */
export function getGoogleMapsApiKey(): string {
  return (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '').trim();
}

/**
 * A Map ID selects a saved cloud styling for the map. Google requires one (or
 * an access token) for projects created from March 2025, so it is offered as an
 * optional variable rather than hardcoded: without it the API still renders the
 * legacy default styling for existing projects.
 */
export function getGoogleMapsMapId(): string {
  return (process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? '').trim();
}

export function isGoogleMapsConfigured(): boolean {
  return getGoogleMapsApiKey().length > 0;
}

/**
 * The `mapId` prop the map components pass through. `undefined` rather than an
 * empty string, because an empty Map ID is refused by the API while omitting it
 * keeps the request valid for projects that do not need one.
 */
export function mapsMapIdProp(): string | undefined {
  return getGoogleMapsMapId() || undefined;
}

/**
 * Inline dark styling for deployments that have no cloud Map ID. When a Map ID
 * is configured the cloud style wins and the legacy `styles` option is ignored,
 * so this is only offered in that case - the operator can then restyle the map
 * from Google Cloud Console without a code change.
 */
const DARK_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#0d1526' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ea3d0' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0f1e' }] },
  {
    featureType: 'administrative',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#2a3a5e' }],
  },
  { featureType: 'poi', stylers: [{ saturation: -80 }, { lightness: -30 }] },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#182340' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#0a0f1e' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#27355c' }],
  },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#081226' }],
  },
];

/**
 * The `styles` prop the map components pass through: the dark palette when no
 * cloud Map ID owns the styling, `undefined` otherwise.
 */
export function mapsStylesProp(): google.maps.MapTypeStyle[] | undefined {
  return getGoogleMapsMapId() ? undefined : DARK_MAP_STYLES;
}
