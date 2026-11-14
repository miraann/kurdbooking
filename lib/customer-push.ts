import "server-only";
import type { PushMessage } from "@/lib/push";
import { fill, fmt } from "@/lib/format";
import { localePath, type Lang } from "@/lib/i18n/config";
import { DICTS } from "@/lib/i18n/dictionaries";
import type { AppointmentStatus } from "@/lib/types";

// Push alerts for customers about their own bookings: the shop confirmed,
// declined, cancelled or finished it, and the day-before reminder.
// Sent with sendPush() (lib/push.ts) to the account in customers.user_id.

export type CustomerEvent = "confirmed" | "declined" | "cancelled" | "completed" | "reminder";

export interface BookingForPush {
  id: string;
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

export function customerMessage(event: CustomerEvent, b: BookingForPush): (lang: Lang) => PushMessage {
  return (lang) => {
    const p = DICTS[lang].push;
    const at = fmt(lang).instant(b.startsAt, b.timeZone);
    const vars = { shop: b.shopName, service: b.service ?? "", date: at.date, time: at.time };
    const receipt = localePath(lang, `/s/${b.shopSlug}/appointment/${b.id}?t=${b.token}`);
    const tag = `booking-${b.id}`;
    switch (event) {
      case "confirmed":
        return { title: p.customerConfirmed, body: fill(p.customerBody, vars), url: receipt, tag };
      case "declined":
        return { title: p.customerDeclined, body: fill(p.customerBody, vars), url: receipt, tag };
      case "cancelled":
        return { title: p.customerCancelled, body: fill(p.customerBody, vars), url: receipt, tag };
      case "completed":
        // Opens the profile, where the visit can be rated.
        return { title: p.customerCompleted, body: fill(p.customerCompletedBody, vars), url: localePath(lang, "/account"), tag };
      case "reminder":
        return { title: p.reminderTitle, body: fill(p.reminderBody, vars), url: receipt, tag: `reminder-${b.id}` };
    }
  };
}
