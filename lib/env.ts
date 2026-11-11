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

export const env = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseKey: () =>
    required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
  supabaseSecret: () => required("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY),
  siteUrl: () => (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, ""),
  /** e.g. "kurdbooking.com" or "localhost:3000". Empty = shops live at /s/<slug>. */
  rootDomain: () => (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "").toLowerCase().trim(),
  supportWhatsapp: () => process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || "",
};
