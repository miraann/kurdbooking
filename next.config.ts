import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components: data is dynamic unless wrapped in 'use cache'.
  // Anything that reads cookies/headers/params must sit inside <Suspense>
  // (or a loading.tsx). See CLAUDE.md → "Next.js 16 rules".
  cacheComponents: true,
  partialPrefetching: true,

  experimental: {
    // Gallery/logo uploads go through Server Actions; the default is 1 MB.
    // The storage bucket itself caps files at 5 MB (supabase/migrations/0005).
    serverActions: { bodySizeLimit: "6mb" },
    // app/global-not-found.tsx: a full 404 page for URLs no route matches
    // (every page is under app/[lang], so there's no root layout to use).
    globalNotFound: true,
  },

  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },

  // Old addresses. The shop list is now the home page, the sales pages are
  // gone (no public prices), and a customer's bookings live in /account.
  // Kurdish has no prefix; /ckb/… is sent to the clean URL by proxy.ts first.
  async redirects() {
    const moved = [
      { from: "/shops", to: "/" },
      { from: "/pricing", to: "/" },
      { from: "/s/:shop/my-bookings", to: "/account" },
    ];
    return moved.flatMap(({ from, to }) => [
      { source: from, destination: to, permanent: false },
      { source: `/:lang(ar|en)${from}`, destination: `/:lang${to === "/" ? "" : to}`, permanent: false },
    ]);
  },

  async headers() {
    return [
      {
        // The push service worker: always fetch the newest one.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        // The customer Android app (native/customer). Always the newest build.
        source: "/kurdbooking.apk",
        headers: [
          { key: "Content-Type", value: "application/vnd.android.package-archive" },
          { key: "Content-Disposition", value: 'attachment; filename="KurdBooking.apk"' },
          { key: "Cache-Control", value: "no-cache" },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy() },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

/**
 * Content-Security-Policy, the same idea as zhewar's next.config.js.
 * Pages are prerendered (Cache Components), so they can't carry a
 * per-request nonce: scripts need 'unsafe-inline' (Next.js's own inline
 * scripts, and the bridge script the Capacitor app injects). What it still
 * blocks: scripts, frames and connections to other sites, plugins, <base>
 * tricks, forms posting elsewhere, and other sites framing our pages.
 * Images come from Supabase Storage only.
 */
function contentSecurityPolicy(): string {
  const dev = process.env.NODE_ENV !== "production";
  const preview = process.env.VERCEL_ENV === "preview"; // Vercel's comment toolbar
  let supabase = "";
  try {
    supabase = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    // No Supabase URL at build time: the pages show the setup error anyway.
  }
  const live = preview ? " https://vercel.live" : "";
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}${live}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${supabase}${preview ? " https://vercel.live https://vercel.com" : ""}`.trim(),
    "font-src 'self'",
    `connect-src 'self' ${supabase}${dev ? " ws: wss:" : ""}${preview ? " https://vercel.live wss://ws-us3.pusher.com" : ""}`.trim(),
    "worker-src 'self'",
    "manifest-src 'self'",
    `frame-src ${preview ? "https://vercel.live" : "'none'"}`,
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export default nextConfig;
