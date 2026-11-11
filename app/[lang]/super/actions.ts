"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/format";
import { echoValues, parseFields } from "@/lib/fields.server";
import type { ActionState, Field } from "@/lib/fields";
import { PAYMENT_FIELDS, PLAN_FIELDS, PLATFORM_SETTINGS_FIELDS, TRIAL_FIELDS } from "@/lib/forms";
import { getActionI18n } from "@/lib/i18n/request";
import type { Lang } from "@/lib/i18n/config";
import { shopSlugTag, shopTag } from "@/lib/shop-data";
import { userMessage } from "@/lib/errors";

// Every action starts with requireSuperAdmin(); RLS checks is_super_admin
// again in the database.

const done = (message: string): ActionState => ({ ok: true, message, nonce: Date.now() });
const failed = (lang: Lang, e: unknown, fields?: Field[], formData?: FormData): ActionState => ({
  ok: false,
  message: userMessage(e, lang),
  values: fields && formData ? echoValues(fields, formData) : undefined,
  nonce: Date.now(),
});

const SLUG = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;
const NEW_SHOP_KEYS = ["shop_name", "slug", "kind", "owner_name", "phone", "email", "password", "request_id"];

/**
 * Only you create shops: the owner's account (already confirmed) + the shop
 * on trial. From /super/shops/new, optionally from a /signup order.
 */
export async function createShop(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { t, href } = await getActionI18n();
  await requireSuperAdmin();
  const e = t.signup.errors;
  const values: Record<string, string> = {};
  for (const k of NEW_SHOP_KEYS) values[k] = String(formData.get(k) ?? "");
  const fail = (message: string): ActionState => ({ ok: false, message, values, nonce: Date.now() });

  const parsed = z
    .object({
      shop_name: z.string().trim().min(2, e.shopNameShort).max(80, e.shopNameLong),
      slug: z.string().trim().toLowerCase().regex(SLUG, e.slug),
      kind: z.enum(["barber", "salon", "both"]),
      owner_name: z.string().trim().min(2, e.ownerName).max(80),
      phone: z.string().trim().min(7, e.phone),
      email: z.string().trim().toLowerCase().email(t.login.invalidEmail),
      password: z.string().min(8, e.password).max(72),
      request_id: z.string().uuid().or(z.literal("")).optional(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? t.errors.invalidData);
  const input = parsed.data;
  const phone = normalizePhone(input.phone);
  if (!phone) return fail(e.phoneInvalid);

  // auth.admin needs the secret key; the super admin check is above.
  const admin = createAdminClient();
  const { data: available, error: slugError } = await admin.rpc("slug_available", { p_slug: input.slug });
  if (slugError) return fail(t.errors.generic);
  if (!available) return fail(e.slugTaken);

  // Created already confirmed: owners shouldn't get stuck on an email link.
  const { data: created, error: userError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.owner_name, phone },
  });
  if (userError || !created.user) {
    const exists = userError?.code === "email_exists" || /already/i.test(userError?.message ?? "");
    return fail(exists ? e.emailExists : e.accountFailed);
  }

  const { data: shopId, error: shopError } = await admin.rpc("create_shop_for_owner", {
    p_owner_id: created.user.id,
    p_name: input.shop_name,
    p_slug: input.slug,
    p_kind: input.kind,
    p_owner_name: input.owner_name,
    p_phone: phone,
  });
  if (shopError || !shopId) {
    await admin.auth.admin.deleteUser(created.user.id); // don't leave an account without a shop
    return fail(shopError?.message.includes("slug_taken") ? e.slugTaken : e.shopFailed);
  }

  if (input.request_id) {
    const supabase = await createClient();
    await supabase.from("shop_requests").update({ status: "done", shop_id: shopId }).eq("id", input.request_id);
  }
  redirect(href(`/super/shops/${shopId}`));
}

/** A /signup order: reject it, or put it back to "new". */
export async function setRequestStatus(requestId: string, status: "new" | "rejected"): Promise<ActionState> {
  const { lang, t } = await getActionI18n();
  await requireSuperAdmin();
  if (status !== "new" && status !== "rejected") return { ok: false, message: t.errors.badStatus };
  const supabase = await createClient();
  const { error } = await supabase.from("shop_requests").update({ status }).eq("id", requestId);
  if (error) return { ok: false, message: userMessage(error, lang) };
  refresh();
  return { ok: true };
}

export async function savePlan(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { lang, t } = await getActionI18n();
  await requireSuperAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "") || null;
  try {
    const row = await parseFields(PLAN_FIELDS, formData, { lang, isNew: !id });
    const { error } = id
      ? await supabase.from("plans").update(row).eq("id", id)
      : await supabase.from("plans").insert(row);
    if (error) throw error;
  } catch (e) {
    return failed(lang, e, PLAN_FIELDS, formData);
  }
  refresh();
  return done(t.common.saved);
}

export async function deletePlan(id: string): Promise<ActionState> {
  const { lang } = await getActionI18n();
  await requireSuperAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("plans").delete().eq("id", id);
  if (error) return { ok: false, message: userMessage(error, lang) };
  refresh();
  return { ok: true };
}

export async function saveSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { lang, t } = await getActionI18n();
  await requireSuperAdmin();
  const supabase = await createClient();
  try {
    const row = await parseFields(PLATFORM_SETTINGS_FIELDS, formData, { lang, isNew: false });
    const { error } = await supabase.from("platform_settings").update({ ...row, updated_at: new Date().toISOString() }).eq("id", true);
    if (error) throw error;
  } catch (e) {
    return failed(lang, e, PLATFORM_SETTINGS_FIELDS, formData);
  }
  refresh();
  return done(t.common.saved);
}

export async function recordPayment(shopId: string, slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { lang, t } = await getActionI18n();
  await requireSuperAdmin();
  const supabase = await createClient();
  const fields = PAYMENT_FIELDS([]);
  try {
    // Plan options are checked by the database (foreign key), not here.
    const planId = String(formData.get("plan_id") ?? "") || null;
    const row = await parseFields(fields.filter((f) => f.name !== "plan_id"), formData, { lang, isNew: true });
    const { error } = await supabase.rpc("record_payment", {
      p_shop_id: shopId,
      p_plan_id: planId,
      p_months: row.months,
      p_amount_iqd: row.amount_iqd,
      p_method: row.method,
      p_reference: row.reference,
      p_note: row.note,
    });
    if (error) throw error;
  } catch (e) {
    return failed(lang, e, fields, formData);
  }
  updateTag(shopSlugTag(slug));
  refresh();
  return done(t.super.shop.paymentRecorded);
}

export async function extendTrial(shopId: string, slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { lang, t } = await getActionI18n();
  await requireSuperAdmin();
  const supabase = await createClient();
  try {
    const { days } = await parseFields(TRIAL_FIELDS, formData, { lang, isNew: true });
    const { error } = await supabase.rpc("extend_trial", { p_shop_id: shopId, p_days: days });
    if (error) throw error;
  } catch (e) {
    return failed(lang, e, TRIAL_FIELDS, formData);
  }
  updateTag(shopSlugTag(slug));
  refresh();
  return done(t.super.shop.trialExtended);
}

/** Hide a shop from the customer app list (its link and QR keep working). */
export async function setShopHidden(shopId: string, hidden: boolean): Promise<ActionState> {
  const { lang } = await getActionI18n();
  await requireSuperAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("shops").update({ hidden_by_admin: hidden }).eq("id", shopId);
  if (error) return { ok: false, message: userMessage(error, lang) };
  refresh();
  return { ok: true };
}

/** Hide (or show again) an abusive review. Only you can; owners can't. */
export async function setReviewHidden(reviewId: string, shopId: string, hidden: boolean): Promise<ActionState> {
  const { lang } = await getActionI18n();
  await requireSuperAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_review_hidden", { p_review_id: reviewId, p_hidden: hidden });
  if (error) return { ok: false, message: userMessage(error, lang) };
  updateTag(shopTag(shopId)); // the public shop page drops or shows it at once
  refresh();
  return { ok: true };
}

/** Suspend or cancel. Bring a shop back with a payment or a trial extension. */
export async function setShopStatus(shopId: string, slug: string, status: "suspended" | "cancelled"): Promise<ActionState> {
  const { lang, t } = await getActionI18n();
  await requireSuperAdmin();
  if (status !== "suspended" && status !== "cancelled") return { ok: false, message: t.errors.badStatus };
  const supabase = await createClient();
  const { error } = await supabase.from("shops").update({ status }).eq("id", shopId);
  if (error) return { ok: false, message: userMessage(error, lang) };
  updateTag(shopSlugTag(slug));
  refresh();
  return { ok: true };
}
