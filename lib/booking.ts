// Free-slot calculation. Pure and time-zone aware, so it gives the same
// answer on the server (UTC) and in tests. Used by the slots API and,
// again, by the booking action right before it saves (never trust the
// slot the browser sends).

export interface DayHours {
  is_open: boolean;
  open_time: string; // "HH:MM" or "HH:MM:SS"
  close_time: string;
  break_start: string | null;
  break_end: string | null;
}

export interface Busy {
  starts_at: string; // ISO
  ends_at: string;
}

const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const toHHMM = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Minutes the zone is ahead of UTC at a given instant (Baghdad → 180). */
export function tzOffsetMinutes(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(at);
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** Wall-clock date + time in a zone → the real instant. */
export function zonedToUtc(dateKey: string, hhmm: string, timeZone: string): Date {
  const [y, mo, d] = dateKey.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let result = guess - tzOffsetMinutes(new Date(guess), timeZone) * 60000;
  // Second pass fixes the rare case where the offset changes (DST) in between.
  result = guess - tzOffsetMinutes(new Date(result), timeZone) * 60000;
  return new Date(result);
}

/** Today's date ("YYYY-MM-DD") in the shop's zone. */
export function todayKey(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function dayOfWeek(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export const isDateKey = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

export interface SlotInput {
  dateKey: string;
  timeZone: string;
  hours: DayHours | null; // staff override if any, else the shop's hours
  isBlocked: boolean;
  durationMinutes: number;
  intervalMinutes: number;
  minNoticeMinutes: number;
  maxDaysAhead: number;
  busy: Busy[];
  now?: Date;
}

/** Free start times ("HH:MM", shop-local) for one staff member on one day. */
export function computeSlots(input: SlotInput): string[] {
  const { dateKey, timeZone, hours, durationMinutes, intervalMinutes } = input;
  const now = input.now ?? new Date();
  if (!isDateKey(dateKey) || input.isBlocked || !hours?.is_open) return [];

  const today = todayKey(timeZone, now);
  if (dateKey < today || dateKey > addDays(today, input.maxDaysAhead)) return [];

  const open = toMinutes(hours.open_time);
  const close = toMinutes(hours.close_time);
  const breakStart = hours.break_start ? toMinutes(hours.break_start) : null;
  const breakEnd = hours.break_end ? toMinutes(hours.break_end) : null;
  const earliest = now.getTime() + input.minNoticeMinutes * 60000;
  const busy = input.busy.map((b) => [Date.parse(b.starts_at), Date.parse(b.ends_at)] as const);

  const slots: string[] = [];
  for (let t = open; t + durationMinutes <= close; t += Math.max(5, intervalMinutes)) {
    const end = t + durationMinutes;
    if (breakStart != null && breakEnd != null && t < breakEnd && end > breakStart) continue;

    const start = zonedToUtc(dateKey, toHHMM(t), timeZone).getTime();
    if (start < earliest) continue;
    const stop = start + durationMinutes * 60000;
    if (busy.some(([bs, be]) => start < be && stop > bs)) continue;

    slots.push(toHHMM(t));
  }
  return slots;
}
