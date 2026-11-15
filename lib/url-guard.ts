// Checks for fetching pages and images from other sites on the server (post
// link previews). Pure functions, unit-tested in url-guard.test.mjs; the
// fetching itself is in lib/safe-fetch.server.ts.
//
// Two layers, because a server that fetches any URL it is given is an open
// proxy into our own network (SSRF):
//   1. Only known social sites (pages) and their image CDNs (images).
//   2. Every address the host name resolves to must be public, on every
//      redirect hop: no loopback, private ranges, link-local (cloud metadata
//      169.254.169.254), CGNAT, multicast or reserved ranges.
// Ported from zhewar app/api/fb-preview.

export type Platform = "instagram" | "facebook" | "tiktok" | "snapchat" | "youtube";

/** Post pages we read the preview from, by platform. A host matches itself and its subdomains. */
const PAGE_HOSTS: Record<Platform, string[]> = {
  instagram: ["instagram.com", "instagr.am"],
  facebook: ["facebook.com", "fb.com", "fb.watch", "fb.me"],
  tiktok: ["tiktok.com"],
  snapchat: ["snapchat.com"],
  youtube: ["youtube.com", "youtu.be"],
};

/** Where those sites keep their preview images. */
const IMAGE_HOSTS = [
  "cdninstagram.com", "fbcdn.net", "fbsbx.com", "instagram.com",
  "tiktokcdn.com", "tiktokcdn-us.com", "tiktokcdn-eu.com", "ibyteimg.com", "byteimg.com",
  "ytimg.com", "ggpht.com", "googleusercontent.com",
  "snapchat.com", "sc-cdn.net", "snapkit.com",
];

const matches = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);
const clean = (host: string) => host.toLowerCase().replace(/\.$/, "");

/** The platform of a post link, or null when it isn't one we read. */
export function platformOf(url: string): Platform | null {
  let host: string;
  try {
    host = clean(new URL(url).hostname);
  } catch {
    return null;
  }
  for (const [platform, domains] of Object.entries(PAGE_HOSTS) as [Platform, string[]][]) {
    if (domains.some((d) => matches(host, d))) return platform;
  }
  return null;
}

export const isPageHost = (host: string) => Object.values(PAGE_HOSTS).flat().some((d) => matches(clean(host), d));
export const isImageHost = (host: string) => IMAGE_HOSTS.some((d) => matches(clean(host), d));

/** http(s), no user:password@, host passes `allowHost`. Doesn't look at DNS (see isPublicIp). */
export function isAllowedUrl(url: string, allowHost: (host: string) => boolean): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  if (u.username || u.password) return false;
  if (u.port && u.port !== "80" && u.port !== "443") return false;
  return allowHost(u.hostname);
}

function ipv4ToNumber(ip: string): number {
  return ip.split(".").reduce((acc, octet) => acc * 256 + Number(octet), 0);
}

const BLOCKED_IPV4 = [
  "0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8", "169.254.0.0/16",
  "172.16.0.0/12", "192.0.0.0/24", "192.0.2.0/24", "192.168.0.0/16",
  "198.18.0.0/15", "198.51.100.0/24", "203.0.113.0/24", "224.0.0.0/4", "240.0.0.0/4",
].map((cidr) => {
  const [range, bits] = cidr.split("/");
  const size = 2 ** (32 - Number(bits));
  const start = Math.floor(ipv4ToNumber(range) / size) * size;
  return [start, start + size] as const;
});

function isPublicIPv4(ip: string): boolean {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip) || ip.split(".").some((o) => Number(o) > 255)) return false;
  const n = ipv4ToNumber(ip);
  return !BLOCKED_IPV4.some(([start, end]) => n >= start && n < end);
}

function isPublicIPv6(ip: string): boolean {
  const a = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (a === "::1" || a === "::") return false; // loopback / unspecified
  if (/^fe[89ab][0-9a-f]?:/.test(a)) return false; // fe80::/10 link-local
  if (/^f[cd][0-9a-f]{0,2}:/.test(a)) return false; // fc00::/7 unique local
  if (a.startsWith("ff")) return false; // multicast
  if (a.startsWith("64:ff9b:") || a.startsWith("2001:db8:")) return false; // NAT64 / documentation
  const mapped = a.match(/^::(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/); // IPv4-mapped / -compatible
  if (mapped) return isPublicIPv4(mapped[1]);
  if (/^::(ffff:)?[0-9a-f]{1,4}:[0-9a-f]{1,4}$/.test(a)) return false; // the same, written in hex
  return true;
}

/** An address that is fine to connect to from our server. */
export function isPublicIp(ip: string, family: 4 | 6): boolean {
  return family === 4 ? isPublicIPv4(ip) : isPublicIPv6(ip);
}

/** Reads <meta property|name="…" content="…"> in either attribute order, with common entities decoded. */
export function metaContent(html: string, key: string): string | null {
  const k = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]*content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${k}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decodeEntities(m[1]).trim() || null;
  }
  return null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** The image type from the first bytes (never trust the Content-Type header alone). */
export function sniffImage(bytes: Uint8Array): { type: string; ext: string } | null {
  const b = (i: number) => bytes[i] ?? -1;
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return { type: "image/jpeg", ext: "jpg" };
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47) return { type: "image/png", ext: "png" };
  if (b(0) === 0x47 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x38) return { type: "image/gif", ext: "gif" };
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (bytes.length > 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { type: "image/webp", ext: "webp" };
  return null;
}
