import "server-only";
import { coordsFromMapsUrl, isMapsHost, type Coords } from "@/lib/maps-link";
import { resolvesToPublic } from "@/lib/safe-fetch.server";
import { isAllowedUrl } from "@/lib/url-guard";

/**
 * The coordinates of a map link an owner pasted. A long Google Maps link has
 * them in the address; a short one (maps.app.goo.gl/…, what «Share» gives)
 * redirects to a long one, so it is followed by hand, never reading a body:
 * at most 5 hops, only map sites, every address the host resolves to public
 * (the same SSRF guard as the link previews). Null when the link has none or
 * can't be opened; the shop is then saved without a pin.
 */
export async function coordsFromMapsLink(link: string): Promise<Coords | null> {
  const signal = AbortSignal.timeout(6000);
  let current = link.trim();
  try {
    for (let hop = 0; hop <= 5; hop++) {
      const found = coordsFromMapsUrl(current);
      if (found) return found;
      if (!isAllowedUrl(current, isMapsHost)) return null;
      if (!(await resolvesToPublic(new URL(current).hostname))) return null;
      const res = await fetch(current, {
        redirect: "manual",
        signal,
        cache: "no-store",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; KurdBooking/1.0)", "Accept-Language": "en-US,en;q=0.9" },
      });
      await res.body?.cancel();
      if (res.status < 300 || res.status >= 400) return null; // a page, not a redirect: nothing more to read
      const location = res.headers.get("location");
      if (!location) return null;
      current = new URL(location, current).toString();
    }
  } catch {
    return null; // timeout, DNS or network error
  }
  return null;
}
