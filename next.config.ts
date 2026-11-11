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

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
