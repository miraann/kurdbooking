"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getShopContent } from "@/lib/shop-data";
import { eligibleStaff, getAvailability } from "@/lib/availability.server";
import { zonedToUtc } from "@/lib/booking";
import { normalizePhone } from "@/lib/format";
import { getActionI18n } from "@/lib/i18n/request";
import type { Dict } from "@/lib/i18n/dictionaries";

/** Built per request so the messages are in the visitor's language. */
const schema = (e: Dict["booking"]["errors"]) =>
  z.object({
    serviceId: z.uuid(),
    staffId: z.union([z.literal("any"), z.uuid()]),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^\d{2}:\d{2}$/),
    name: z.string().trim().min(2, e.name).max(80, e.nameLong),
    phone: z.string().trim().min(7, e.phone).max(20),
    note: z.string().trim().max(500).optional(),
  });

export type BookingInput = z.input<ReturnType<typeof schema>>;
export type BookingResult =
  | { ok: true; id: string; token: string; status: "pending" | "confirmed"; staffName: string }
  | { ok: false; message: string; slotTaken?: boolean };

const LIVE = ["trial", "active", "past_due"];
const MAX_UPCOMING_PER_PHONE = 3;

/**
 * Public booking. Everything the browser sends is re-checked here: the shop
 * is live, the service/staff belong to it, and the time is still free. The
 * database's no-overlap constraint is the last guard against a race.
 */
export async function bookAppointment(slug: string, raw: BookingInput): Promise<BookingResult> {
  const { t } = await getActionI18n();
  const e = t.booking.errors;
  const taken: BookingResult = { ok: false, message: e.taken, slotTaken: true };

  const parsed = schema(e).safeParse(raw);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? t.errors.invalidData };
  const input = parsed.data;
  const phone = normalizePhone(input.phone);
  if (!phone) return { ok: false, message: e.phoneInvalid };

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

  const { data: customer, error: customerError } = await admin
    .from("customers")
    .upsert({ shop_id: shop.id, full_name: input.name, phone }, { onConflict: "shop_id,phone" })
    .select("id, blocked_at")
    .single();
  if (customerError || !customer) return { ok: false, message: e.saveFailed };
  // The owner blocked this customer (the database refuses the booking too).
  if (customer.blocked_at) return { ok: false, message: e.blocked };

  // Simple spam guard: one phone can't hold many future bookings at once.
  const { count } = await admin
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", shop.id)
    .eq("customer_id", customer.id)
    .in("status", ["pending", "confirmed"])
    .gte("starts_at", new Date().toISOString());
  if ((count ?? 0) >= MAX_UPCOMING_PER_PHONE) {
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

  // TODO (roadmap): push notification to the owner's apps (port lib/pushNotifications.ts from zhewar).
  return { ok: true, id: appointment.id, token: appointment.public_token, status, staffName: chosen.name };
}
