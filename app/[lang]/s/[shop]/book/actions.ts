"use server";

import { after } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getShopContent } from "@/lib/shop-data";
import { eligibleStaff, getAvailability } from "@/lib/availability.server";
import { zonedToUtc } from "@/lib/booking";
import { displayPhone, fill, fmt } from "@/lib/format";
import { getViewer } from "@/lib/customer";
import { notifyShop } from "@/lib/push";
import { allowAttempt } from "@/lib/rate-limit";
import { DICTS } from "@/lib/i18n/dictionaries";
import { localePath } from "@/lib/i18n/config";
import { getActionI18n } from "@/lib/i18n/request";

// The picked slot only: the customer comes from the session.
const schema = z.object({
  serviceId: z.uuid(),
  staffId: z.union([z.literal("any"), z.uuid()]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  note: z.string().trim().max(500).optional(),
});

export type BookingInput = z.input<typeof schema>;
export type BookingResult =
  | { ok: true; id: string; token: string; status: "pending" | "confirmed"; staffName: string }
  | { ok: false; message: string; slotTaken?: boolean; needProfile?: boolean };

const LIVE = ["trial", "active", "past_due"];
const MAX_UPCOMING_PER_CUSTOMER = 3;

/**
 * Booking by a logged-in customer. Who books comes from the session (name
 * from the profile, phone from the account), never from the form. Everything
 * the browser sends is re-checked here: the shop is live, the service/staff
 * belong to it, and the time is still free. The database's no-overlap
 * constraint is the last guard against a race.
 */
export async function bookAppointment(slug: string, raw: BookingInput): Promise<BookingResult> {
  const { t } = await getActionI18n();
  const e = t.booking.errors;
  const taken: BookingResult = { ok: false, message: e.taken, slotTaken: true };

  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? t.errors.invalidData };
  const input = parsed.data;
  const viewer = await getViewer();
  if (viewer.kind !== "customer") return { ok: false, message: e.loginRequired, needProfile: true };
  const { id: userId, phone } = viewer.customer;
  const name = viewer.customer.name.trim() || displayPhone(phone);
  // Per-IP limit against scripted bookings (lib/rate-limit.ts).
  if (!(await allowAttempt("booking"))) return { ok: false, message: t.errors.tooFast };

  const admin = createAdminClient();
  const { data: shop } = await admin.from("shops").select("id, status, timezone").eq("slug", slug).maybeSingle();
  if (!shop || !LIVE.includes(shop.status)) return { ok: false, message: e.shopClosed };

  const content = await getShopContent(shop.id);
  if (!content.profile?.booking_enabled) return { ok: false, message: e.bookingOff };
  const service = content.services.find((s) => s.id === input.serviceId);
  if (!service) return { ok: false, message: e.noService };

  let staff = eligibleStaff(content.staff, content.staffServices, service.id);
  if (input.staffId !== "any") staff = staff.filter((s) => s.id === input.staffId);
  const byStaff = await getAvailability({
    shopId: shop.id, timeZone: shop.timezone, profile: content.profile, service, staff, dateKey: input.date,
  });
  const chosen = staff.find((s) => byStaff.get(s.id)?.includes(input.time));
  if (!chosen) return taken;

  // One customers row per phone per shop. It is linked to the account here
  // (only the server may set user_id), so the booking shows in /account.
  const { data: customer, error: customerError } = await admin
    .from("customers")
    .upsert({ shop_id: shop.id, full_name: name, phone, user_id: userId }, { onConflict: "shop_id,phone" })
    .select("id, blocked_at")
    .single();
  if (customerError || !customer) return { ok: false, message: e.saveFailed };
  // The owner blocked this customer (the database refuses the booking too).
  if (customer.blocked_at) return { ok: false, message: e.blocked };

  // Simple spam guard: one customer can't hold many future bookings at once.
  const { count } = await admin
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", shop.id)
    .eq("customer_id", customer.id)
    .in("status", ["pending", "confirmed"])
    .gte("starts_at", new Date().toISOString());
  if ((count ?? 0) >= MAX_UPCOMING_PER_CUSTOMER) {
    return { ok: false, message: e.tooMany };
  }

  const startsAt = zonedToUtc(input.date, input.time, shop.timezone);
  const endsAt = new Date(startsAt.getTime() + service.duration_minutes * 60000);
  const status = content.profile.auto_confirm ? "confirmed" : "pending";

  const { data: appointment, error } = await admin
    .from("appointments")
    .insert({
      shop_id: shop.id,
      customer_id: customer.id,
      staff_id: chosen.id,
      service_id: service.id,
      service_name: service.name,
      duration_minutes: service.duration_minutes,
      price_iqd: service.price_iqd,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status,
      customer_note: input.note || null,
    })
    .select("id, public_token")
    .single();

  if (error?.code === "23P01") return taken;
  if (error?.message?.includes("customer_blocked")) return { ok: false, message: e.blocked };
  if (error || !appointment) return { ok: false, message: e.insertFailed };

  // Push alert to the owners/managers (and the chosen staff member), after
  // the customer already has their answer.
  const when = startsAt.toISOString();
  after(() =>
    notifyShop(shop.id, chosen.id, (lang) => {
      const p = DICTS[lang].push;
      const at = fmt(lang).instant(when, shop.timezone);
      return {
        title: status === "pending" ? p.newBookingPending : p.newBookingConfirmed,
        body: fill(p.newBookingBody, { name, phone: displayPhone(phone), service: service.name, staff: chosen.name, date: at.date, time: at.time }),
        url: localePath(lang, status === "pending" ? "/dashboard/appointments?view=pending" : "/dashboard/appointments"),
        tag: `booking-${appointment.id}`,
      };
    }).catch((err) => console.error("booking push failed", err)),
  );
  return { ok: true, id: appointment.id, token: appointment.public_token, status, staffName: chosen.name };
}
