import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Supabase client with the SECRET key: bypasses RLS.
 * Use only on the server, only after checking who is asking, and always
 * filter by shop_id yourself. Used for: shop orders (/signup), creating shops in /super, writing bookings, renaming a
 * shop after an owner check.
 */
export function createAdminClient() {
  return createClient(env.supabaseUrl(), env.supabaseSecret(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
