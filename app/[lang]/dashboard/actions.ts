"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { CURRENT_SHOP_COOKIE, requireShop, getShopContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { echoValues, FieldError, parseFields, removeImages } from "@/lib/fields.server";
import type { ActionState } from "@/lib/fields";
import { isResourceKey, RESOURCES, type ResourceKey } from "@/lib/resources";
import { withShopOptions } from "@/lib/resources.server";
import { APP_FIELDS, BOOKING_FIELDS, PROFILE_FIELDS, REPLY_FIELDS } from "@/lib/forms";
import { LISTED_SHOPS_TAG, shopSlugTag, shopTag } from "@/lib/shop-data";
import { userMessage } from "@/lib/errors";
import { digits, fill } from "@/lib/format";
import { getActionI18n } from "@/lib/i18n/request";
import type { Lang } from "@/lib/i18n/config";
import { DICTS } from "@/lib/i18n/dictionaries";
import type { AppointmentStatus } from "@/lib/types";
import { sendPush } from "@/lib/push";
import { customerEvent, customerMessage, type BookingForPush } from "@/lib/customer-push";

// Every action re-checks the user and their role (requireShop) and scopes
// every query by shop_id. RLS enforces the same rules again in the database.

const saved = (lang: Lang): ActionState => ({ ok: true, message: DICTS[lang].common.saved, nonce: Date.now() });

function afterChange(shopId: string) {
  updateTag(shopTag(shopId)); // public shop page shows the change at once
  updateTag(LISTED_SHOPS_TAG); // and the customer shops list (logo, tagline …)
  refresh(); // re-render the dashboard page
}

// ── Lists: services, staff, gallery, posts, links, locations … ─────────────

export async function saveResource(key: ResourceKey, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { lang, t } = await getActionI18n();
  if (!isResourceKey(key)) return { ok: false, message: t.common.unknown, nonce: Date.now() };
  const cfg = RESOURCES[key];
  const { shop } = await requireShop(["owner", "manager"]);
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "") || null;

  try {
    const fields = await withShopOptions(cfg.fields, supabase, shop.id); // e.g. only this shop's staff
    const row = await parseFields(fields, formData, { lang, supabase, shopId: shop.id, isNew: !id });
    const problem = cfg.check?.(row);
    if (problem) throw new FieldError(t.errors[problem]);

    if (id) {
      let oldImage: string | null = null;
      if (cfg.imageField && cfg.imageField in row) {
        const { data } = await supabase.from(cfg.table).select(cfg.imageField).eq("id", id).eq("shop_id", shop.id).maybeSingle();
        oldImage = (data as Record<string, string | null> | null)?.[cfg.imageField] ?? null;
      }
      const { error } = await supabase.from(cfg.table).update(row).eq("id", id).eq("shop_id", shop.id);
      if (error) throw error;
      if (cfg.imageField && oldImage && oldImage !== row[cfg.imageField]) await removeImages(supabase, [oldImage]);
    } else {
      if (cfg.limit) await checkPlanLimit(shop.plan_id, shop.id, cfg.table, cfg.limit, lang);
      const { error } = await supabase.from(cfg.table).insert({ ...row, shop_id: shop.id });
      if (error) throw error;
    }
  } catch (e) {
    return { ok: false, message: userMessage(e, lang), values: echoValues(cfg.fields, formData), nonce: Date.now() };
  }

  afterChange(shop.id);
  return saved(lang);
}

export async function deleteResource(key: ResourceKey, id: string): Promise<ActionState> {
  const { lang, t } = await getActionI18n();
  if (!isResourceKey(key)) return { ok: false, message: t.common.unknown };
  const cfg = RESOURCES[key];
  const { shop } = await requireShop(["owner", "manager"]);
  const supabase = await createClient();

  const { data, error } = await supabase.from(cfg.table).delete().eq("id", id).eq("shop_id", shop.id).select("*").maybeSingle();
  if (error) return { ok: false, message: userMessage(error, lang) };
  if (cfg.imageField && data) await removeImages(supabase, [(data as Record<string, string | null>)[cfg.imageField]]);

  afterChange(shop.id);
  return { ok: true };
}

/** Plans may cap staff / gallery photos / locations. No plan (trial) = no cap. */
async function checkPlanLimit(planId: string | null, shopId: string, table: string, column: string, lang: Lang) {
  if (!planId) return;
  const admin = createAdminClient(); // private plans aren't readable by owners
  const { data: plan } = await admin.from("plans").select(column).eq("id", planId).maybeSingle();
  const max = (plan as Record<string, number | null> | null)?.[column];
  if (!max) return;
  const { count } = await admin.from(table).select("id", { count: "exact", head: true }).eq("shop_id", shopId);
  if ((count ?? 0) >= max) throw new FieldError(fill(DICTS[lang].errors.planLimit, { max: digits(max, lang) }));
}

// ── Shop profile & booking settings ────────────────────────────────────────

export async function saveProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { lang, t } = await getActionI18n();
  const { shop, role } = await requireShop(["owner", "manager"]);
  const supabase = await createClient();
  try {
    const { name, ...profile } = await parseFields(PROFILE_FIELDS, formData, { lang, supabase, shopId: shop.id, isNew: false });

    const { data: old } = await supabase.from("shop_profile").select("logo_url, cover_url").eq("shop_id", shop.id).maybeSingle();
    const { error } = await supabase.from("shop_profile").update(profile).eq("shop_id", shop.id);
    if (error) throw error;
    const replaced = (["logo_url", "cover_url"] as const).filter((k) => k in profile && old?.[k] && old[k] !== profile[k]);
    await removeImages(supabase, replaced.map((k) => old?.[k]));

    // Only the owner renames the shop. The shops table is locked to the
    // super admin by RLS, so this one write uses the secret key.
    if (name !== shop.name) {
      if (role !== "owner") throw new FieldError(t.errors.ownerRename);
      const { error: nameError } = await createAdminClient().from("shops").update({ name }).eq("id", shop.id);
      if (nameError) throw nameError;
      updateTag(shopSlugTag(shop.slug));
    }
  } catch (e) {
    return { ok: false, message: userMessage(e, lang), values: echoValues(PROFILE_FIELDS, formData), nonce: Date.now() };
  }
  afterChange(shop.id);
  return saved(lang);
}

export async function saveBookingSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { lang } = await getActionI18n();
  const { shop } = await requireShop(["owner", "manager"]);
  const supabase = await createClient();
  try {
    const row = await parseFields(BOOKING_FIELDS, formData, { lang, isNew: false });
    const { error } = await supabase.from("shop_profile").update(row).eq("shop_id", shop.id);
    if (error) throw error;
  } catch (e) {
    return { ok: false, message: userMessage(e, lang), values: echoValues(BOOKING_FIELDS, formData), nonce: Date.now() };
  }
  afterChange(shop.id);
  return saved(lang);
}

/** «پیشاندان لە ئەپ»: show the shop in the customer app list (0008 set_shop_listed). */
export async function saveAppListing(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { lang } = await getActionI18n();
  const { shop } = await requireShop(["owner", "manager"]);
  const supabase = await createClient();
  try {
    const { listed } = await parseFields(APP_FIELDS, formData, { lang, isNew: false });
    const { error } = await supabase.rpc("set_shop_listed", { p_shop_id: shop.id, p_listed: listed === true });
    if (error) throw error;
  } catch (e) {
    return { ok: false, message: userMessage(e, lang), nonce: Date.now() };
  }
  updateTag(LISTED_SHOPS_TAG);
  refresh();
  return saved(lang);
}

// ── Weekly hours (the shop's, or one staff member's own) ──────────────────

const TIME = /^\d{2}:\d{2}$/;

/** Writes the 7 days of a submitted <HoursForm>. staffId null = the shop's hours. */
async function writeWeek(supabase: Awaited<ReturnType<typeof createClient>>, shopId: string, staffId: string | null, formData: FormData, lang: Lang) {
  const t = DICTS[lang];
  for (let d = 0; d < 7; d++) {
    const isOpen = formData.has(`open_${d}`);
    const open = String(formData.get(`from_${d}`) ?? "");
    const close = String(formData.get(`to_${d}`) ?? "");
    const bs = String(formData.get(`bstart_${d}`) ?? "");
    const be = String(formData.get(`bend_${d}`) ?? "");
    if (!TIME.test(open) || !TIME.test(close) || close <= open) throw new FieldError(t.errors.hours);
    const hasBreak = TIME.test(bs) && TIME.test(be);
    if (hasBreak && (be <= bs || bs < open || be > close)) throw new FieldError(t.errors.breakHours);

    const row = { is_open: isOpen, open_time: open, close_time: close, break_start: hasBreak ? bs : null, break_end: hasBreak ? be : null };
    let update = supabase.from("working_hours").update(row).eq("shop_id", shopId).eq("day_of_week", d);
    update = staffId ? update.eq("staff_id", staffId) : update.is("staff_id", null);
    const { data, error } = await update.select("id");
    if (error) throw error;
    if (!data?.length) {
      const { error: insertError } = await supabase.from("working_hours").insert({ ...row, shop_id: shopId, staff_id: staffId, day_of_week: d });
      if (insertError) throw insertError;
    }
  }
}

export async function saveHours(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { lang } = await getActionI18n();
  const { shop } = await requireShop(["owner", "manager"]);
  const supabase = await createClient();
  try {
    await writeWeek(supabase, shop.id, null, formData, lang);
  } catch (e) {
    return { ok: false, message: userMessage(e, lang), nonce: Date.now() };
  }
  afterChange(shop.id);
  return saved(lang);
}

// ── One staff member: own hours and the services they do ───────────────────

/** The staff row, only if it belongs to this shop (never trust the id from the browser). */
async function shopStaff(supabase: Awaited<ReturnType<typeof createClient>>, shopId: string, staffId: string) {
  if (!z.uuid().safeParse(staffId).success) return null;
  const { data } = await supabase.from("staff").select("id, name, user_id").eq("shop_id", shopId).eq("id", staffId).maybeSingle();
  return data as { id: string; name: string; user_id: string | null } | null;
}

/** Saves a staff member's own week: from now on the shop's hours don't apply to them. */
export async function saveStaffHours(staffId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { lang, t } = await getActionI18n();
  const { shop } = await requireShop(["owner", "manager"]);
  const supabase = await createClient();
  try {
    if (!(await shopStaff(supabase, shop.id, staffId))) throw new FieldError(t.common.unknown);
    await writeWeek(supabase, shop.id, staffId, formData, lang);
  } catch (e) {
    return { ok: false, message: userMessage(e, lang), nonce: Date.now() };
  }
  afterChange(shop.id);
  return saved(lang);
}

/** Drops a staff member's own week, so they follow the shop's hours again. */
export async function followShopHours(staffId: string): Promise<ActionState> {
  const { lang, t } = await getActionI18n();
  const { shop } = await requireShop(["owner", "manager"]);
  const supabase = await createClient();
  if (!(await shopStaff(supabase, shop.id, staffId))) return { ok: false, message: t.common.unknown };
  const { error } = await supabase.from("working_hours").delete().eq("shop_id", shop.id).eq("staff_id", staffId);
  if (error) return { ok: false, message: userMessage(error, lang) };
  afterChange(shop.id);
  return { ok: true };
}

/**
 * Which services a staff member does. The form has one switch per service
 * (svc_<id>). All on = no rows (they do every service, new ones included).
 */
export async function saveStaffServices(staffId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { lang, t } = await getActionI18n();
  const { shop } = await requireShop(["owner", "manager"]);
  const supabase = await createClient();
  try {
    if (!(await shopStaff(supabase, shop.id, staffId))) throw new FieldError(t.common.unknown);
    const { data: services, error } = await supabase.from("services").select("id").eq("shop_id", shop.id);
    if (error) throw error;
    const all = (services ?? []).map((s) => s.id as string);
    const chosen = all.filter((id) => formData.has(`svc_${id}`));
    if (all.length > 0 && chosen.length === 0) throw new FieldError(t.dashboard.staffDetail.needOne);

    const { error: deleteError } = await supabase.from("staff_services").delete().eq("shop_id", shop.id).eq("staff_id", staffId);
    if (deleteError) throw deleteError;
    if (chosen.length < all.length) {
      const { error: insertError } = await supabase
        .from("staff_services")
        .insert(chosen.map((service_id) => ({ shop_id: shop.id, staff_id: staffId, service_id })));
      if (insertError) throw insertError;
    }
  } catch (e) {
    return { ok: false, message: userMessage(e, lang), nonce: Date.now() };
  }
  afterChange(shop.id);
  return saved(lang);
}

// ── Appointments ───────────────────────────────────────────────────────────

const STATUSES: AppointmentStatus[] = ["pending", "confirmed", "cancelled", "completed", "no_show"];

export async function setAppointmentStatus(id: string, status: AppointmentStatus): Promise<ActionState> {
  const { lang, t } = await getActionI18n();
  if (!STATUSES.includes(status)) return { ok: false, message: t.errors.badStatus };
  const { shop } = await requireShop();
  const supabase = await createClient();
  const { data: before } = await supabase
    .from("appointments")
    .select("status, starts_at, service_name, public_token, customers(user_id)")
    .eq("id", id)
    .eq("shop_id", shop.id)
    .maybeSingle();
  if (!before) return { ok: false, message: t.common.unknown };
  const { error } = await supabase.from("appointments").update({ status }).eq("id", id).eq("shop_id", shop.id);
  if (error) return { ok: false, message: userMessage(error, lang) };

  // Tell the customer (their profile's devices), after the owner has the answer.
  const userId = (before.customers as unknown as { user_id: string | null } | null)?.user_id;
  const event = customerEvent(before.status as AppointmentStatus, status);
  if (userId && event) {
    const booking: BookingForPush = {
      id, token: before.public_token, shopName: shop.name, shopSlug: shop.slug, timeZone: shop.timezone,
      service: before.service_name, startsAt: before.starts_at,
    };
    after(() => sendPush([userId], customerMessage(event, booking)).catch((err) => console.error("customer push failed", err)));
  }
  refresh();
  return { ok: true };
}

// ── Customers: block / unblock ─────────────────────────────────────────────

/** A blocked customer can't book at this shop (the database refuses it too). */
export async function setCustomerBlocked(customerId: string, blocked: boolean): Promise<ActionState> {
  const { lang } = await getActionI18n();
  const { shop } = await requireShop(["owner", "manager"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({ blocked_at: blocked ? new Date().toISOString() : null })
    .eq("id", customerId)
    .eq("shop_id", shop.id);
  if (error) return { ok: false, message: userMessage(error, lang) };
  refresh();
  return { ok: true };
}

// ── Reviews ────────────────────────────────────────────────────────────────

/** The owner or a manager replies once (0008 reply_to_review checks the shop). */
export async function replyToReview(reviewId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { lang } = await getActionI18n();
  const { shop } = await requireShop(["owner", "manager"]);
  const supabase = await createClient();
  try {
    const { reply } = await parseFields(REPLY_FIELDS, formData, { lang, isNew: true });
    const { data: review } = await supabase.from("reviews").select("id").eq("id", reviewId).eq("shop_id", shop.id).maybeSingle();
    if (!review) throw new FieldError(DICTS[lang].common.unknown);
    const { error } = await supabase.rpc("reply_to_review", { p_review_id: reviewId, p_reply: reply });
    if (error) throw error;
  } catch (e) {
    return { ok: false, message: userMessage(e, lang), values: echoValues(REPLY_FIELDS, formData), nonce: Date.now() };
  }
  afterChange(shop.id); // the reply shows on the public shop page
  return saved(lang);
}

// ── Session ────────────────────────────────────────────────────────────────

export async function switchShop(shopId: string) {
  const ctx = await getShopContext();
  if (!ctx?.shops.some((s) => s.id === shopId)) return;
  (await cookies()).set(CURRENT_SHOP_COOKIE, shopId, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  redirect((await getActionI18n()).href("/dashboard"));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect((await getActionI18n()).href("/login"));
}
