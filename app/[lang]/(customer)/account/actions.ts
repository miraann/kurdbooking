"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { customerEmail, getViewer, isCustomerMeta } from "@/lib/customer";
import { allowAttempt } from "@/lib/rate-limit";
import { checkPhoneCode, sendPhoneCode } from "@/lib/phone-code.server";
import { whatsappEnabled } from "@/lib/whatsapp.server";
import { displayPhone, fill, fmt, normalizePhone } from "@/lib/format";
import { notifyShop } from "@/lib/push";
import { notifyWaitlist } from "@/lib/waitlist.server";
import { LISTED_SHOPS_TAG, shopTag } from "@/lib/shop-data";
import { DICTS } from "@/lib/i18n/dictionaries";
import { getActionI18n } from "@/lib/i18n/request";
import { localePath, splitLocale } from "@/lib/i18n/config";
import type { ActionState } from "@/lib/fields";

// Customer accounts: create a profile, log in, log out, cancel a booking.
// Logging in or out sets the session cookie, so Next.js re-renders the page
// the form is on (the booking page keeps the chosen service and time).
// With a `next` path the form goes there instead.

/** Only paths on this site (no "//evil.com"). Stored without the language prefix. */
function goNext(next: unknown, href: (path: string) => string): void {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//")) return;
  redirect(splitLocale(next).prefix ? next : href(next));
}

/** The customer account of a phone, or null (0018 customer_user_id). */
async function customerIdOf(phone: string): Promise<string | null> {
  const { data } = await createAdminClient().rpc("customer_user_id", { p_phone: phone });
  return typeof data === "string" ? data : null;
}

type CodeErrors = { codeFailed: string; codeWrong: string };

/** Sends a WhatsApp code and reports it as the "enter the code" step (or the reason it failed). */
async function sendCodeStep(
  phone: string,
  purpose: "signup" | "reset",
  e: CodeErrors,
  tooFast: string,
  values: Record<string, string>,
): Promise<ActionState> {
  const sent = await sendPhoneCode(phone, purpose);
  if (sent === "sent") return { ok: false, step: "code", values, nonce: Date.now() };
  return { ok: false, message: sent === "too_fast" ? tooFast : e.codeFailed, values, nonce: Date.now() };
}

export async function customerSignup(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { t, href } = await getActionI18n();
  const e = t.account.errors;
  const values = { full_name: String(formData.get("full_name") ?? ""), phone: String(formData.get("phone") ?? "") };
  const fail = (message?: string, step?: "code"): ActionState => ({ ok: false, message, step, values, nonce: Date.now() });

  const parsed = z
    .object({
      full_name: z.string().trim().min(2, e.name).max(80, e.nameLong),
      phone: z.string().trim().min(7, e.phone).max(20, e.phone),
      password: z.string().min(6, e.password).max(72, e.passwordLong),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message);
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) return fail(e.phone);
  if (!(await allowAttempt("customerSignup"))) return fail(t.errors.tooFast);

  // With WhatsApp set up, the phone must be proven first: the first submit
  // sends a code, the second (with the code) creates the profile.
  const verify = whatsappEnabled();
  if (verify) {
    if (await customerIdOf(phone)) return fail(e.exists);
    const code = String(formData.get("code") ?? "").trim();
    if (!code || formData.get("resend")) return sendCodeStep(phone, "signup", e, t.errors.tooFast, values);
    if (!(await checkPhoneCode(phone, "signup", code))) return fail(e.codeWrong, "code");
  }

  // Created confirmed (there is no email to confirm). app_metadata marks the
  // account as a customer and holds the phone; only the server can change it.
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email: customerEmail(phone),
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.full_name, phone },
    app_metadata: { kind: "customer", phone, ...(verify ? { phone_verified: true } : {}) },
  });
  if (error) {
    const exists = error.code === "email_exists" || /already/i.test(error.message);
    if (!exists) console.error("customer signup failed", error.code, error.message);
    return fail(exists ? e.exists : e.failed);
  }

  const supabase = await createClient();
  const { error: loginError } = await supabase.auth.signInWithPassword({ email: customerEmail(phone), password: parsed.data.password });
  if (loginError) return fail(e.failed);

  goNext(formData.get("next"), href);
  return { ok: true, nonce: Date.now() };
}

/**
 * Forgot password: a WhatsApp code proves the phone, then the new password is
 * set and the customer is logged in. Needs WhatsApp to be set up; without it a
 * forgotten password can't be recovered by the customer.
 */
export async function customerResetPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { t, href } = await getActionI18n();
  const e = t.account.errors;
  const values = { phone: String(formData.get("phone") ?? "") };
  const fail = (message?: string, step?: "code"): ActionState => ({ ok: false, message, step, values, nonce: Date.now() });

  const phone = normalizePhone(values.phone);
  if (!phone) return fail(e.phone);
  if (!whatsappEnabled()) return fail(e.resetUnavailable);
  const userId = await customerIdOf(phone);
  if (!userId) return fail(e.noProfile);

  const code = String(formData.get("code") ?? "").trim();
  if (!code || formData.get("resend")) return sendCodeStep(phone, "reset", e, t.errors.tooFast, values);

  const password = String(formData.get("password") ?? "");
  if (password.length < 6) return fail(e.password, "code");
  if (password.length > 72) return fail(e.passwordLong, "code");
  if (!(await checkPhoneCode(phone, "reset", code))) return fail(e.codeWrong, "code");

  const { error } = await createAdminClient().auth.admin.updateUserById(userId, {
    password,
    app_metadata: { kind: "customer", phone, phone_verified: true },
  });
  if (error) {
    console.error("customer password reset failed", error.code, error.message);
    return fail(e.failed);
  }
  const supabase = await createClient();
  const { error: loginError } = await supabase.auth.signInWithPassword({ email: customerEmail(phone), password });
  if (loginError) return fail(e.failed);

  goNext(formData.get("next"), href);
  return { ok: true, nonce: Date.now() };
}

export async function customerLogin(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { t, href } = await getActionI18n();
  const e = t.account.errors;
  const values = { phone: String(formData.get("phone") ?? "") };
  const fail = (message?: string): ActionState => ({ ok: false, message, values, nonce: Date.now() });

  const phone = normalizePhone(values.phone);
  const password = String(formData.get("password") ?? "");
  if (!phone) return fail(e.phone);
  if (!password) return fail(t.login.passwordRequired);
  // Supabase sees our server's IP, not the visitor's, so we limit per visitor here.
  if (!(await allowAttempt("login"))) return fail(t.errors.tooFast);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: customerEmail(phone), password });
  if (error || !data.user) return fail(e.wrong);
  if (!isCustomerMeta(data.user.app_metadata)) {
    await supabase.auth.signOut({ scope: "local" });
    return fail(e.wrong);
  }

  goNext(formData.get("next"), href);
  return { ok: true, nonce: Date.now() };
}

/** Logs out this device only (the customer may be logged in on another phone). */
export async function customerLogout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
}

/** The customer cancels their own upcoming booking (checked by cancel_my_appointment). */
export async function cancelMyBooking(id: string): Promise<{ ok: boolean; message?: string }> {
  const { t } = await getActionI18n();
  const viewer = await getViewer();
  if (viewer.kind !== "customer") return { ok: false, message: t.booking.errors.loginRequired };
  if (!z.uuid().safeParse(id).success) return { ok: false, message: t.account.errors.cancelFailed };

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_my_appointment", { p_appointment_id: id });
  if (error) return { ok: false, message: t.account.errors.cancelFailed };

  // Tell the owners/managers (and the booked staff member). RLS lets the
  // customer read their own booking; the shop's time zone needs the secret key.
  const { data: appt } = await supabase
    .from("appointments")
    .select("shop_id, staff_id, service_name, starts_at")
    .eq("id", id)
    .maybeSingle();
  if (appt) {
    const { name, phone } = viewer.customer;
    after(async () => {
      const { data: shop } = await createAdminClient().from("shops").select("timezone").eq("id", appt.shop_id).maybeSingle();
      const timeZone = shop?.timezone ?? "Asia/Baghdad";
      await notifyShop(appt.shop_id, appt.staff_id, (lang) => {
        const p = DICTS[lang].push;
        const at = fmt(lang).instant(appt.starts_at, timeZone);
        return {
          title: p.bookingCancelled,
          body: fill(p.newBookingBody, { name, phone: displayPhone(phone), service: appt.service_name ?? "", date: at.date, time: at.time }),
          url: localePath(lang, "/dashboard/appointments"),
          tag: `booking-${id}`,
        };
      }).catch((err) => console.error("cancel push failed", err));
      // A time opened: tell the people waiting for that day (0016 waitlist).
      await notifyWaitlist({ shopId: appt.shop_id, staffId: appt.staff_id, startsAt: appt.starts_at }).catch((err) =>
        console.error("waitlist failed", err),
      );
    });
  }
  refresh(); // the list shows the new status
  return { ok: true };
}

/**
 * The customer rates a completed visit, once (checked by submit_review). The
 * stars show on the shop page and the shop list at once; the shop gets a push.
 */
export async function submitMyReview(id: string, rating: number, body: string): Promise<{ ok: boolean; message?: string }> {
  const { t } = await getActionI18n();
  const e = t.account.errors;
  const viewer = await getViewer();
  if (viewer.kind !== "customer") return { ok: false, message: t.booking.errors.loginRequired };
  const parsed = z
    .object({ id: z.uuid(), rating: z.number().int().min(1).max(5), body: z.string().trim().max(1000) })
    .safeParse({ id, rating, body });
  if (!parsed.success) return { ok: false, message: e.pickRating };

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("submit_review", { p_appointment_id: parsed.data.id, p_rating: parsed.data.rating, p_body: parsed.data.body || null })
    .single();
  if (error || !data) {
    const msg = String(error?.message ?? "");
    return { ok: false, message: msg.includes("already_reviewed") ? e.alreadyReviewed : e.reviewFailed };
  }
  const review = data as { id: string; shop_id: string; rating: number; body: string | null; reviewer_name: string };

  updateTag(shopTag(review.shop_id)); // rating + review on the shop page
  updateTag(LISTED_SHOPS_TAG); // rating on the shop list
  after(() =>
    notifyShop(review.shop_id, null, (lang) => {
      const p = DICTS[lang].push;
      return {
        title: fill(p.newReviewTitle, { stars: "★".repeat(review.rating) }),
        body: fill(p.newReviewBody, { name: review.reviewer_name || viewer.customer.name, text: review.body ?? "" }).trim(),
        url: localePath(lang, "/dashboard/reviews"),
        tag: `review-${review.id}`,
      };
    }).catch((err) => console.error("review push failed", err)),
  );
  refresh();
  return { ok: true };
}

/** Leave a waitlist (RLS: only your own rows). */
export async function leaveWaitlist(id: string): Promise<{ ok: boolean; message?: string }> {
  const { t } = await getActionI18n();
  const viewer = await getViewer();
  if (viewer.kind !== "customer" || !z.uuid().safeParse(id).success) return { ok: false, message: t.errors.generic };
  const supabase = await createClient();
  const { error } = await supabase.from("waitlist").delete().eq("id", id).eq("user_id", viewer.customer.id);
  if (error) return { ok: false, message: t.errors.generic };
  refresh();
  return { ok: true };
}
