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
