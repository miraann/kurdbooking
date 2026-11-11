"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { displayPhone, fill, normalizePhone } from "@/lib/format";
import { notifySuperAdmins } from "@/lib/push";
import { DICTS } from "@/lib/i18n/dictionaries";
import { getActionI18n } from "@/lib/i18n/request";
import { localePath, splitLocale } from "@/lib/i18n/config";
import type { Dict } from "@/lib/i18n/dictionaries";
import type { ActionState } from "@/lib/fields";

/** Built per request so the messages are in the visitor's language. */
const requestSchema = (t: Dict) => {
  const e = t.signup.errors;
  return z.object({
    shop_name: z.string().trim().min(2, e.shopNameShort).max(80, e.shopNameLong),
    kind: z.enum(["barber", "salon", "both"]),
    owner_name: z.string().trim().min(2, e.ownerName).max(80),
    phone: z.string().trim().min(7, e.phone).max(20, e.phoneInvalid),
    city: z.string().trim().max(60).optional(),
    note: z.string().trim().max(500).optional(),
    website: z.string().max(0).optional(), // honeypot: bots fill it, people don't see it
  });
};

const REQUEST_KEYS = ["shop_name", "kind", "owner_name", "phone", "city", "note"];

function formValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of REQUEST_KEYS) out[k] = String(formData.get(k) ?? "");
  return out;
}

const fail = (message: string, formData: FormData): ActionState => ({
  ok: false, message, values: formValues(formData), nonce: Date.now(),
});

/**
 * /signup: saves an order for the system. It creates no account and no shop:
 * only you do that, from the order, in /super/shops/new.
 */
export async function requestShop(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { t } = await getActionI18n();
  const parsed = requestSchema(t).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? t.errors.invalidData, formData);
  const input = parsed.data;
  const phone = normalizePhone(input.phone);
  if (!phone) return fail(t.signup.errors.phoneInvalid, formData);

  // Public form → secret key (visitors can't write the table themselves).
  const admin = createAdminClient();

  // The same phone sending again within a day: keep the first order only.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await admin
    .from("shop_requests")
    .select("id", { count: "exact", head: true })
    .eq("phone", phone)
    .gte("created_at", since);
  if (countError) return fail(t.signup.errors.sendFailed, formData);

  if (!count) {
    const { error } = await admin.from("shop_requests").insert({
      shop_name: input.shop_name,
      kind: input.kind,
      owner_name: input.owner_name,
      phone,
      city: input.city || null,
      note: input.note || null,
    });
    if (error) return fail(t.signup.errors.sendFailed, formData);

    // Push alert to you, after the visitor already has their answer.
    after(() =>
      notifySuperAdmins((lang) => ({
        title: DICTS[lang].push.newOrderTitle,
        body: fill(DICTS[lang].push.newOrderBody, { shop: input.shop_name, owner: input.owner_name, phone: displayPhone(phone) }),
        url: localePath(lang, "/super/requests"),
        tag: "shop-request",
      })).catch((e) => console.error("order push failed", e)),
    );
  }
  return { ok: true, values: { phone }, nonce: Date.now() };
}

// Two separate logins: /login for shop owners and staff, /super/login for
// you. Each one refuses the other kind of account.
type LoginKind = "owner" | "super";

async function signIn(kind: LoginKind, formData: FormData): Promise<ActionState> {
  const { t, href } = await getActionI18n();
  const parsed = z
    .object({
      email: z.string().trim().toLowerCase().email(t.login.invalidEmail),
      password: z.string().min(1, t.login.passwordRequired),
      next: z.string().optional(),
    })
    .safeParse(Object.fromEntries(formData));
  const values = { email: String(formData.get("email") ?? "") };
  const fail = (message?: string): ActionState => ({ ok: false, message, values, nonce: Date.now() });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error || !data.user) return fail(t.login.wrong);

  const { data: profile } = await supabase.from("profiles").select("is_super_admin").eq("id", data.user.id).maybeSingle();
  const isSuper = !!profile?.is_super_admin;
  if (isSuper !== (kind === "super")) {
    await supabase.auth.signOut();
    return fail(kind === "super" ? t.login.notAdmin : t.login.adminAccount);
  }

  // `next` is a path without the language prefix (proxy.ts / lib/auth.ts set
  // it). Each login only follows links into its own area.
  const home = kind === "super" ? "/super" : "/dashboard";
  const next = parsed.data.next ?? "";
  if (next.startsWith("/") && !next.startsWith("//")) {
    const { path } = splitLocale(next);
    const isSuperPath = path === "/super" || path.startsWith("/super/");
    if (isSuperPath === (kind === "super")) redirect(splitLocale(next).prefix ? next : href(next));
  }
  redirect(href(home));
}

/** /login: shop owners and staff only. */
export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return signIn("owner", formData);
}

/** /super/login: the super admin only. */
export async function superLogin(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return signIn("super", formData);
}
