import "server-only";
import { headers } from "next/headers";
import { env } from "@/lib/env";

/** Header proxy.ts sets when a page was reached through a shop subdomain. */
export const SHOP_HOST_HEADER = "x-kb-shop-host";

/** Absolute public link to a shop page (for QR codes, sharing, WhatsApp). */
export function shopUrl(slug: string, path = ""): string {
  const root = env.rootDomain();
  if (root) {
    const protocol = root.startsWith("localhost") ? "http" : "https";
    return `${protocol}://${slug}.${root}${path}`;
  }
  return `${env.siteUrl()}/s/${slug}${path}`;
}

/**
 * Prefix for links inside a shop page: "" on the shop's own subdomain,
 * "/s/<slug>" on the main site. Reads request headers → call it inside
 * <Suspense> (shop pages already are).
 */
export async function shopBasePath(slug: string): Promise<string> {
  const h = await headers();
  return h.get(SHOP_HOST_HEADER) === slug ? "" : `/s/${slug}`;
}
