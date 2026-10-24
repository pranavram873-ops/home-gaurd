/**
 * Address search for the duty-post picker.
 *
 * Uses Google's Maps JavaScript Geocoder, loaded by the same API as the map.
 *
 * What comes back is only ever a *suggestion*. The coordinate that gets filed is
 * the pin the operator places, so a wrong search result cannot put a geofence in
 * the wrong place unless someone drags it there - which is why a failed search
 * is a notice and never a blocker. Google requires billing and the Geocoding
 * API enabled on the Cloud project.
 */

export interface GeoResult {
  id: string;
  label: string;
  lat: number;
  lng: number;
}

/** Below three characters the matches are usually too broad to be useful. */
export const MIN_SEARCH_LENGTH = 3;

export async function searchPlaces(geocoder: google.maps.Geocoder, query: string): Promise<GeoResult[]> {
  const term = query.trim();
  if (term.length < MIN_SEARCH_LENGTH) return [];

  const { results } = await geocoder.geocode({
    address: term,
    componentRestrictions: { country: 'IN' },
    region: 'IN',
  });
  return results.slice(0, 6).map((item, index) => ({
    id: item.place_id || `${item.formatted_address}-${index}`,
    label: item.formatted_address,
    lat: item.geometry.location.lat(),
    lng: item.geometry.location.lng(),
  }));
}
