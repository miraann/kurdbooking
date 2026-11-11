"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { refresh, updateTag } from "next/cache";
import { CURRENT_SHOP_COOKIE, requireShop, getShopContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { echoValues, FieldError, parseFields, removeImages } from "@/lib/fields.server";
import type { ActionState } from "@/lib/fields";
import { isResourceKey, RESOURCES, type ResourceKey } from "@/lib/resources";
import { withShopOptions } from "@/lib/resources.server";
import { BOOKING_FIELDS, PROFILE_FIELDS } from "@/lib/forms";
import { shopSlugTag, shopTag } from "@/lib/shop-data";
import { userMessage } from "@/lib/errors";
import { digits, fill } from "@/lib/format";
import { getActionI18n } from "@/lib/i18n/request";
import type { Lang } from "@/lib/i18n/config";
import { DICTS } from "@/lib/i18n/dictionaries";
import type { AppointmentStatus } from "@/lib/types";

// Every action re-checks the user and their role (requireShop) and scopes
// every query by shop_id. RLS enforces the same rules again in the database.

const saved = (lang: Lang): ActionState => ({ ok: true, message: DICTS[lang].common.saved, nonce: Date.now() });

function afterChange(shopId: string) {
  updateTag(shopTag(shopId)); // public shop page shows the change at once
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

// ── Weekly hours ───────────────────────────────────────────────────────────

const TIME = /^\d{2}:\d{2}$/;

export async function saveHours(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { lang, t } = await getActionI18n();
  const { shop } = await requireShop(["owner", "manager"]);
  const supabase = await createClient();
  try {
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
      const { data, error } = await supabase
        .from("working_hours").update(row)
        .eq("shop_id", shop.id).is("staff_id", null).eq("day_of_week", d)
        .select("id");
      if (error) throw error;
      if (!data?.length) {
        const { error: insertError } = await supabase.from("working_hours").insert({ ...row, shop_id: shop.id, day_of_week: d });
        if (insertError) throw insertError;
      }
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
  const { error } = await supabase.from("appointments").update({ status }).eq("id", id).eq("shop_id", shop.id);
  if (error) return { ok: false, message: userMessage(error, lang) };
  refresh();
  return { ok: true };
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
