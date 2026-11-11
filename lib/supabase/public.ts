import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Supabase client with the publishable key and NO cookies: sees only what
 * RLS allows the public (live shops' content, public plans). Safe to use
 * inside 'use cache' functions, because it never reads the request.
 */
export function createPublicClient() {
  return createClient(env.supabaseUrl(), env.supabaseKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
