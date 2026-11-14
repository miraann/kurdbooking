import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Customer accounts (the customer app and the public booking page).
//
// A customer signs up with name + phone + password, and needs an account only
// to book. Supabase Auth has no phone login without an SMS provider, so the
// account's login is a stand-in email made from the phone, on the reserved
// ".invalid" domain (RFC 2606): mail to it can never be delivered, so no reset
// link can reach anyone. The real phone is kept in app_metadata, which only
// the server (secret key) can write, and travels inside the signed session.
//
// Not verified yet: anyone can register any number. Phase 6 plans a WhatsApp
// code at signup and "forgot password" (docs/ROADMAP.md).

export const CUSTOMER_EMAIL_DOMAIN = "phone.invalid";

/** "9647701234567" → "9647701234567@phone.invalid" */
export const customerEmail = (phone: string) => `${phone}@${CUSTOMER_EMAIL_DOMAIN}`;

export const isCustomerEmail = (email: string) => email.trim().toLowerCase().endsWith(`@${CUSTOMER_EMAIL_DOMAIN}`);

/** app_metadata of a customer account (set by customerSignup). */
export interface CustomerMeta {
  kind: "customer";
  phone: string;
}

export const isCustomerMeta = (meta: unknown): meta is CustomerMeta =>
  !!meta &&
  typeof meta === "object" &&
  (meta as { kind?: unknown }).kind === "customer" &&
  typeof (meta as { phone?: unknown }).phone === "string";

export interface Customer {
  id: string;
  name: string;
  phone: string; // 9647XXXXXXXXX
}

/**
 * Who is looking at a customer page:
 * - guest: not logged in
 * - customer: a customer account
 * - staff: a shop owner/staff or the super admin (they book as customers
 *   from a separate customer account)
 */
export type Viewer = { kind: "guest" } | { kind: "customer"; customer: Customer } | { kind: "staff" };

/** Reads cookies: call it inside <Suspense>, a Server Action or a Route Handler. */
export const getViewer = cache(async (): Promise<Viewer> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return { kind: "guest" };
  if (!isCustomerMeta(claims.app_metadata)) return { kind: "staff" };
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", claims.sub).maybeSingle();
  return {
    kind: "customer",
    customer: { id: claims.sub, name: profile?.full_name ?? "", phone: claims.app_metadata.phone },
  };
});
