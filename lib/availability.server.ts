import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { addDays, computeSlots, dayOfWeek, isDateKey, zonedToUtc, type ClosedRange, type DayHours } from "@/lib/booking";
import type { BlockedDate, Service, ShopProfile, Staff, WorkingHours } from "@/lib/types";

// Free times per staff member for one service on one day. Reads existing
// bookings with the secret key (start/end only, never customer details).

export interface AvailabilityInput {
  shopId: string;
  timeZone: string;
  profile: Pick<ShopProfile, "slot_interval_minutes" | "min_notice_minutes" | "max_days_ahead">;
  service: Pick<Service, "id" | "duration_minutes">;
  staff: Pick<Staff, "id">[]; // eligible staff (already filtered for the service)
  dateKey: string;
}

/** Staff that can do a service: active, and either mapped to it or mapped to nothing. */
export function eligibleStaff<T extends Pick<Staff, "id" | "is_active">>(
  staff: T[],
  links: { staff_id: string; service_id: string }[],
  serviceId: string,
): T[] {
  return staff.filter((s) => {
    if (!s.is_active) return false;
    const mine = links.filter((l) => l.staff_id === s.id);
    return mine.length === 0 || mine.some((l) => l.service_id === serviceId);
  });
}

export async function getAvailability(input: AvailabilityInput): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (!isDateKey(input.dateKey) || input.staff.length === 0) return result;

  const admin = createAdminClient();
  const staffIds = input.staff.map((s) => s.id);
  const dow = dayOfWeek(input.dateKey);
  // A day in the shop's zone, padded so bookings that cross midnight still count.
  const from = zonedToUtc(addDays(input.dateKey, -1), "00:00", input.timeZone).toISOString();
  const to = zonedToUtc(addDays(input.dateKey, 2), "00:00", input.timeZone).toISOString();

  const [hoursRes, blockedRes, busyRes] = await Promise.all([
    admin.from("working_hours").select("*").eq("shop_id", input.shopId).eq("day_of_week", dow),
    admin.from("blocked_dates").select("*").eq("shop_id", input.shopId).eq("date", input.dateKey),
    admin
      .from("appointments")
      .select("staff_id, starts_at, ends_at")
      .eq("shop_id", input.shopId)
      .in("staff_id", staffIds)
      .in("status", ["pending", "confirmed"])
      .lt("starts_at", to)
      .gt("ends_at", from),
  ]);
  if (hoursRes.error) throw hoursRes.error;
  if (blockedRes.error) throw blockedRes.error;
  if (busyRes.error) throw busyRes.error;

  const hours = (hoursRes.data ?? []) as WorkingHours[];
  const blocked = (blockedRes.data ?? []) as BlockedDate[];
  const busy = (busyRes.data ?? []) as { staff_id: string; starts_at: string; ends_at: string }[];
  const shopHours = hours.find((h) => h.staff_id === null) ?? null;
  // Rows without times close the whole day; rows with times close a range.
  const wholeDay = (staffId: string | null) => blocked.some((b) => b.staff_id === staffId && !b.start_time);
  const ranges = (staffId: string | null): ClosedRange[] =>
    blocked
      .filter((b) => b.staff_id === staffId && b.start_time && b.end_time)
      .map((b) => ({ start: b.start_time!.slice(0, 5), end: b.end_time!.slice(0, 5) }));
  const shopClosed = wholeDay(null);
  const shopRanges = ranges(null);

  for (const id of staffIds) {
    const own = hours.find((h) => h.staff_id === id);
    result.set(
      id,
      computeSlots({
        dateKey: input.dateKey,
        timeZone: input.timeZone,
        hours: (own ?? shopHours) as DayHours | null,
        isBlocked: shopClosed || wholeDay(id),
        closed: [...shopRanges, ...ranges(id)],
        durationMinutes: input.service.duration_minutes,
        intervalMinutes: input.profile.slot_interval_minutes,
        minNoticeMinutes: input.profile.min_notice_minutes,
        maxDaysAhead: input.profile.max_days_ahead,
        busy: busy.filter((b) => b.staff_id === id),
      }),
    );
  }
  return result;
}

/** Union of all staff slots, sorted ("any staff member" option). */
export function mergeSlots(byStaff: Map<string, string[]>): string[] {
  return [...new Set([...byStaff.values()].flat())].sort();
}
