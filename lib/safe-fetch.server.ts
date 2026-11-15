import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { isAllowedUrl, isPublicIp } from "@/lib/url-guard";

// Fetches a page or image from another site for a link preview, with the
// checks in lib/url-guard.ts applied to the first URL and to every redirect:
// allowed host, http(s) only, and every address the host resolves to public.
// Redirects are followed by hand (at most 4), the whole request has a time
// limit, and the body is cut off at maxBytes.

export interface Fetched {
  url: string;
  contentType: string;
  body: Uint8Array<ArrayBuffer>;
}

async function resolvesToPublic(host: string): Promise<boolean> {
  const bare = host.replace(/^\[|\]$/g, "");
  const literal = isIP(bare);
  if (literal) return isPublicIp(bare, literal as 4 | 6);
  try {
    const records = await lookup(bare, { all: true, verbatim: true });
    return records.length > 0 && records.every((r) => isPublicIp(r.address, r.family as 4 | 6));
  } catch {
    return false;
  }
}

async function readCapped(res: Response, maxBytes: number): Promise<Uint8Array<ArrayBuffer> | null> {
  const declared = Number(res.headers.get("content-length") ?? "0");
  if (declared > maxBytes) return null;
  if (!res.body) return new Uint8Array();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}

export async function safeFetch(
  url: string,
  opts: { allowHost: (host: string) => boolean; maxBytes: number; accept: string; timeoutMs?: number },
): Promise<Fetched | null> {
  const signal = AbortSignal.timeout(opts.timeoutMs ?? 8000);
  let current = url;
  try {
    for (let hop = 0; hop <= 4; hop++) {
      if (!isAllowedUrl(current, opts.allowHost)) return null;
      if (!(await resolvesToPublic(new URL(current).hostname))) return null;
      const res = await fetch(current, {
        redirect: "manual",
        signal,
        cache: "no-store",
        headers: {
          // The preview crawler's name: these sites send their og: tags to it.
          "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
          "Accept-Language": "en-US,en;q=0.9",
          Accept: opts.accept,
        },
      });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        await res.body?.cancel();
        if (!location) return null;
        current = new URL(location, current).toString();
        continue;
      }
      if (!res.ok) {
        await res.body?.cancel();
        return null;
      }
      const body = await readCapped(res, opts.maxBytes);
      if (!body) return null;
      return { url: current, contentType: (res.headers.get("content-type") ?? "").toLowerCase(), body };
    }
  } catch {
    return null; // timeout, DNS or network error: no preview
  }
  return null;
}
