import "server-only";
import { sendPush, type PushMessage } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { fill, fmt } from "@/lib/format";
import { localePath, type Lang } from "@/lib/i18n/config";
import { DICTS } from "@/lib/i18n/dictionaries";
import type { AppointmentStatus } from "@/lib/types";

// What customers are told about their own bookings: the shop confirmed,
// declined, cancelled or finished it, the day-before reminder, and a time that
// opened on a waitlist day.
//
// Each alert goes two places (notifyCustomer / notifyWaitlist):
//   * the inbox (public.customer_notifications, 0019): the «ئاگادارکردنەوە» tab
//     of the customer app, which works with no push device at all
//   * a push to the account in customers.user_id (lib/push.ts)
// The wording lives here once, for both.

export type CustomerEvent = "confirmed" | "declined" | "cancelled" | "completed" | "reminder";
/** Everything the inbox can hold (0019 kind). */
export type InboxKind = CustomerEvent | "waitlist";

export interface BookingForPush {
  id: string;
  shopId: string;
  token: string;
  shopName: string;
  shopSlug: string;
  timeZone: string;
  service: string | null;
  startsAt: string;
}

/** Which alert a status change sends to the customer (none for no-show or going back to pending). */
export function customerEvent(from: AppointmentStatus, to: AppointmentStatus): CustomerEvent | null {
  if (from === to) return null;
  if (to === "confirmed") return "confirmed";
  if (to === "cancelled") return from === "pending" ? "declined" : "cancelled";
  if (to === "completed") return "completed";
  return null;
}

/** Title and text of a booking alert, in one language (the push and the inbox row). */
export function eventText(
  event: CustomerEvent,
  lang: Lang,
  b: { shopName: string; service: string | null; startsAt: string; timeZone: string },
): { title: string; body: string } {
  const p = DICTS[lang].push;
  const at = fmt(lang).instant(b.startsAt, b.timeZone);
  const vars = { shop: b.shopName, service: b.service ?? "", date: at.date, time: at.time };
  switch (event) {
    case "confirmed":
      return { title: p.customerConfirmed, body: fill(p.customerBody, vars) };
    case "declined":
      return { title: p.customerDeclined, body: fill(p.customerBody, vars) };
    case "cancelled":
      return { title: p.customerCancelled, body: fill(p.customerBody, vars) };
    case "completed":
      return { title: p.customerCompleted, body: fill(p.customerCompletedBody, vars) };
    case "reminder":
      return { title: p.reminderTitle, body: fill(p.reminderBody, vars) };
  }
}

/** Title and text of «a time opened on this day». */
export function waitlistText(lang: Lang, shopName: string, dateKey: string): { title: string; body: string } {
  const p = DICTS[lang].push;
  return { title: fill(p.waitlistTitle, { shop: shopName }), body: fill(p.waitlistBody, { date: fmt(lang).date(dateKey) }) };
}

/** Where tapping a booking alert goes (without the language prefix). */
export function eventPath(event: CustomerEvent, b: { id: string; shopSlug: string; token: string }): string {
  // «Thank you»: opens the profile, where the visit can be rated.
  return event === "completed" ? "/account" : `/s/${b.shopSlug}/appointment/${b.id}?t=${b.token}`;
}

/** Where tapping a waitlist alert goes (without the language prefix). */
export function waitlistPath(shopSlug: string, dateKey: string, serviceId: string | null): string {
  return `/s/${shopSlug}/book?date=${dateKey}${serviceId ? `&service=${serviceId}` : ""}`;
}

export function customerMessage(event: CustomerEvent, b: BookingForPush): (lang: Lang) => PushMessage {
  return (lang) => ({
    ...eventText(event, lang, b),
    url: localePath(lang, eventPath(event, { id: b.id, shopSlug: b.shopSlug, token: b.token })),
    tag: event === "reminder" ? `reminder-${b.id}` : `booking-${b.id}`,
  });
}

/**
 * Tells a customer about their booking: an inbox row first (a failure there is
 * logged and never stops the push), then the push. Returns the push result.
 * A reminder is stored once per booking (unique index), whatever the job does.
 */
export async function notifyCustomer(userId: string, event: CustomerEvent, b: BookingForPush): Promise<{ sent: number; failed: number }> {
  const { error } = await createAdminClient()
    .from("customer_notifications")
    .insert({ user_id: userId, shop_id: b.shopId, kind: event, appointment_id: b.id });
  if (error && error.code !== "23505") console.error("inbox write failed", event, b.id, error);
  return sendPush([userId], customerMessage(event, b));
}
