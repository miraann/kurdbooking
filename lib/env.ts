// Reads environment variables with a clear message when one is missing,
// instead of a vague Supabase error deep inside a page.

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.example to .env.local and fill it in (see README.md → Setup).`,
    );
  }
  return value;
}

/**
 * The site's own address. NEXT_PUBLIC_SITE_URL wins (set it once there is a
 * real domain). Without it, on Vercel, the project's production address that
 * Vercel provides by itself; locally, localhost.
 */
export function siteUrl(): string {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
  const url = process.env.NEXT_PUBLIC_SITE_URL || (vercel ? `https://${vercel}` : "http://localhost:3000");
  return url.replace(/\/$/, "");
}

export const env = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseKey: () =>
    required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
  supabaseSecret: () => required("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY),
  siteUrl,
  /** e.g. "kurdbooking.com" or "localhost:3000". Empty = shops live at /s/<slug>. */
  rootDomain: () => (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "").toLowerCase().trim(),
  supportWhatsapp: () => process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || "",
};
