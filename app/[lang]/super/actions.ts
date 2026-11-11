"use server";

import { refresh, updateTag } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
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
