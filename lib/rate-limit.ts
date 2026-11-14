import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

// Rate limits for public forms and logins, counted in the database
// (hit_rate_limit, 0012_rate_limits.sql). Like zhewar's Upstash limits, but
// with no extra service. Mobile networks here put many people behind one IP,
// so the limits are loose: they stop scripts, not customers.

export const LIMITS = {
  booking: { max: 8, windowSeconds: 10 * 60 }, // per IP
  shopRequest: { max: 5, windowSeconds: 60 * 60 }, // /signup orders, per IP
  login: { max: 10, windowSeconds: 10 * 60 }, // both logins, per IP
  passwordEmail: { max: 5, windowSeconds: 60 * 60 }, // /forgot-password, per IP
  passwordChange: { max: 5, windowSeconds: 10 * 60 }, // Settings, per account
} as const;

export type LimitKind = keyof typeof LIMITS;

/**
 * The visitor's IP as a keyed hash (the IP itself is never stored). On Vercel
 * the first x-forwarded-for entry is the real client; Vercel overwrites any
 * value the browser sends.
 */
async function hashedIp(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return createHmac("sha256", env.supabaseSecret()).update(ip).digest("base64url").slice(0, 32);
}

/**
 * Counts one attempt. true = go ahead, false = too many, ask to wait.
 * `id` replaces the IP for per-account limits. If the database can't answer,
 * the attempt is let through: the form's own database write would fail too.
 */
export async function allowAttempt(kind: LimitKind, id?: string): Promise<boolean> {
  const { max, windowSeconds } = LIMITS[kind];
  const key = `${kind}:${id ?? (await hashedIp())}`;
  const { data, error } = await createAdminClient().rpc("hit_rate_limit", {
    p_key: key,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("rate limit check failed", error.message);
    return true;
  }
  return data !== false;
}
