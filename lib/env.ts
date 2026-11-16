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
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  // A localhost value copied from .env.local into Vercel would send every
  // link (shop footer, push alerts, reset links) to localhost: on Vercel,
  // its own address wins over a localhost one.
  const local = !fromEnv || /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(fromEnv);
  const url = !local ? fromEnv : vercel ? `https://${vercel}` : fromEnv || "http://localhost:3000";
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
  /**
   * WhatsApp Cloud API (Meta), for phone verification codes. null = not set up:
   * customers then sign up without a code. See docs/whatsapp-setup.md.
   */
  whatsapp: () => {
    const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
    const template = process.env.WHATSAPP_TEMPLATE_NAME?.trim();
    if (!token || !phoneNumberId || !template) return null;
    return {
      token,
      phoneNumberId,
      template,
      // Authentication templates can't be written in Kurdish (Meta has no
      // Kurdish template language); Arabic is what people here read.
      language: process.env.WHATSAPP_TEMPLATE_LANG?.trim() || "ar",
      version: process.env.WHATSAPP_API_VERSION?.trim() || "v23.0",
    };
  },
};
