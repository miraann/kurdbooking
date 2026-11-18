// Coordinates inside a map link. Owners paste the link from Google Maps «Share»
// (a short maps.app.goo.gl link, or the long one), and the shop gets a pin on
// the customer app's map without typing latitude and longitude.
// Pure functions, unit-tested in maps-link.test.mjs; opening short links is in
// lib/maps-link.server.ts.

export interface Coords {
  lat: number;
  lng: number;
}

const NUM = String.raw`(-?\d{1,3}(?:\.\d+)?)`;
const PLACE_PIN = new RegExp(`!3d${NUM}!4d${NUM}`); // …/data=!3m1!4b1!4m6!3m5!…!8m2!3d35.55!4d45.43
const VIEW_CENTER = new RegExp(`@${NUM},${NUM}`); //  …/maps/place/Name/@35.55,45.43,17z
const PAIR = new RegExp(`^\\s*${NUM}\\s*,\\s*${NUM}\\s*$`); // 35.55,45.43
const PAIR_PARAMS = ["q", "ll", "query", "destination", "daddr", "center"];

function valid(lat: number, lng: number): Coords | null {
  // 0,0 is what a missing value turns into: never a real shop.
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

/** Coordinates written in a map link, or null (a short link has none until it is opened). */
export function coordsFromMapsUrl(link: string): Coords | null {
  let text = link.trim();
  try {
    text = decodeURIComponent(text); // …q=35.55%2C45.43
  } catch {
    // keep the raw text
  }
  // 1. The place's own pin beats the centre of the map view.
  for (const re of [PLACE_PIN, VIEW_CENTER]) {
    const m = re.exec(text);
    if (m) {
      const c = valid(Number(m[1]), Number(m[2]));
      if (c) return c;
    }
  }
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  // 2. ?q=35.55,45.43 (also ll, query, destination …)
  for (const key of PAIR_PARAMS) {
    const m = PAIR.exec(url.searchParams.get(key) ?? "");
    if (m) {
      const c = valid(Number(m[1]), Number(m[2]));
      if (c) return c;
    }
  }
  // 3. OpenStreetMap: ?mlat=…&mlon=… or #map=17/35.55/45.43
  const mlat = url.searchParams.get("mlat");
  const mlon = url.searchParams.get("mlon");
  if (mlat && mlon) {
    const c = valid(Number(mlat), Number(mlon));
    if (c) return c;
  }
  const osm = new RegExp(`#map=\\d{1,2}/${NUM}/${NUM}`).exec(url.hash);
  return osm ? valid(Number(osm[1]), Number(osm[2])) : null;
}

const MAPS_HOSTS = ["google.com", "goo.gl", "g.co", "g.page", "openstreetmap.org", "osm.org"];

/** Sites a short map link may redirect through (a host matches itself and its subdomains). */
export const isMapsHost = (host: string) => {
  const h = host.toLowerCase().replace(/\.$/, "");
  return MAPS_HOSTS.some((d) => h === d || h.endsWith(`.${d}`));
};
