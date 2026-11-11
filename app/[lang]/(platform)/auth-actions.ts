"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/format";
import { getActionI18n } from "@/lib/i18n/request";
import { splitLocale } from "@/lib/i18n/config";
import type { Dict } from "@/lib/i18n/dictionaries";
import type { ActionState } from "@/lib/fields";

const SLUG = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;

/** Built per request so the messages are in the visitor's language. */
const signupSchema = (t: Dict) => {
  const e = t.signup.errors;
  return z.object({
    shop_name: z.string().trim().min(2, e.shopNameShort).max(80, e.shopNameLong),
    slug: z.string().trim().toLowerCase().regex(SLUG, e.slug),
    kind: z.enum(["barber", "salon", "both"]),
    owner_name: z.string().trim().min(2, e.ownerName).max(80),
    phone: z.string().trim().min(7, e.phone),
    email: z.string().trim().toLowerCase().email(t.login.invalidEmail),
    password: z.string().min(8, e.password).max(72),
    website: z.string().max(0).optional(), // honeypot: bots fill it, people don't see it
  });
};

function formValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of ["shop_name", "slug", "kind", "owner_name", "phone", "email"]) out[k] = String(formData.get(k) ?? "");
  return out;
}

const fail = (message: string, formData: FormData): ActionState => ({
  ok: false, message, values: formValues(formData), nonce: Date.now(),
});

/** Creates the owner account + the shop (trial), signs in, opens the dashboard. */
export async function signup(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { t, href } = await getActionI18n();
  const e = t.signup.errors;
  const parsed = signupSchema(t).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? t.errors.invalidData, formData);
  const input = parsed.data;
  const phone = normalizePhone(input.phone);
  if (!phone) return fail(e.phoneInvalid, formData);

  const admin = createAdminClient();
  const { data: available, error: slugError } = await admin.rpc("slug_available", { p_slug: input.slug });
  if (slugError) return fail(t.errors.generic, formData);
  if (!available) return fail(e.slugTaken, formData);

  // Created already confirmed: shop owners shouldn't get stuck on an email link.
  const { data: created, error: userError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.owner_name, phone },
  });
  if (userError || !created.user) {
    const exists = userError?.code === "email_exists" || /already/i.test(userError?.message ?? "");
    return fail(exists ? e.emailExists : e.accountFailed, formData);
  }

  const { error: shopError } = await admin.rpc("create_shop_for_owner", {
    p_owner_id: created.user.id,
    p_name: input.shop_name,
    p_slug: input.slug,
    p_kind: input.kind,
    p_owner_name: input.owner_name,
    p_phone: phone,
  });
  if (shopError) {
    await admin.auth.admin.deleteUser(created.user.id); // don't leave an account without a shop
    return fail(shopError.message.includes("slug_taken") ? e.slugTaken : e.shopFailed, formData);
  }

  const supabase = await createClient();
  await supabase.auth.signInWithPassword({ email: input.email, password: input.password });
  redirect(href("/dashboard?welcome=1"));
}

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { t, href } = await getActionI18n();
  const parsed = z
    .object({
      email: z.string().trim().toLowerCase().email(t.login.invalidEmail),
      password: z.string().min(1, t.login.passwordRequired),
      next: z.string().optional(),
    })
    .safeParse(Object.fromEntries(formData));
  const values = { email: String(formData.get("email") ?? "") };
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message, values, nonce: Date.now() };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error || !data.user) return { ok: false, message: t.login.wrong, values, nonce: Date.now() };

  // `next` is a path without the language prefix (proxy.ts / lib/auth.ts set it).
  const next = parsed.data.next ?? "";
  if (next.startsWith("/") && !next.startsWith("//")) redirect(splitLocale(next).prefix ? next : href(next));

  const { data: profile } = await supabase.from("profiles").select("is_super_admin").eq("id", data.user.id).maybeSingle();
  redirect(href(profile?.is_super_admin ? "/super" : "/dashboard"));
}
