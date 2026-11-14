"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { refresh } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { customerEmail, getViewer, isCustomerMeta } from "@/lib/customer";
import { allowAttempt } from "@/lib/rate-limit";
import { displayPhone, fill, fmt, normalizePhone } from "@/lib/format";
import { notifyShop } from "@/lib/push";
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

export async function customerSignup(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { t, href } = await getActionI18n();
  const e = t.account.errors;
  const values = { full_name: String(formData.get("full_name") ?? ""), phone: String(formData.get("phone") ?? "") };
  const fail = (message?: string): ActionState => ({ ok: false, message, values, nonce: Date.now() });

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

  // Created confirmed (there is no email to confirm). app_metadata marks the
  // account as a customer and holds the phone; only the server can change it.
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email: customerEmail(phone),
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.full_name, phone },
    app_metadata: { kind: "customer", phone },
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
    });
  }
  refresh(); // the list shows the new status
  return { ok: true };
}
