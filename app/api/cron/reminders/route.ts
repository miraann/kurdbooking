import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPush } from "@/lib/push";
import { addDays, todayKey } from "@/lib/booking";
import { fmt } from "@/lib/format";
import { customerMessage } from "@/lib/customer-push";

// Day-before reminders. Vercel runs this once a day (vercel.json → crons,
// 15:00 UTC = 18:00 in Iraq): every customer with a confirmed booking
// tomorrow (in the shop's time zone) gets a push on their profile's devices.
//
// Set CRON_SECRET on Vercel: Vercel then sends it as a Bearer token and every
// other caller is refused. Without it the job still runs, and it is harmless
// to call: a booking is reminded at most once (reminded_at, 0014), and only
// bookings for tomorrow are touched.

const LIVE = ["trial", "active", "past_due"];
const DAY = 24 * 60 * 60 * 1000;

type Row = {
  id: string;
  starts_at: string;
  service_name: string | null;
  public_token: string;
  customers: { user_id: string | null } | null;
  shops: { name: string; slug: string; timezone: string; status: string } | null;
};

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!secret) console.warn("reminders: CRON_SECRET is not set, so anyone can start this job (it is idempotent)");

  const admin = createAdminClient();
  const now = new Date();
  const { data, error } = await admin
    .from("appointments")
    .select("id, starts_at, service_name, public_token, customers(user_id), shops(name, slug, timezone, status)")
    .eq("status", "confirmed")
    .is("reminded_at", null)
    .gt("starts_at", now.toISOString())
    .lt("starts_at", new Date(now.getTime() + 2 * DAY).toISOString())
    .limit(2000);
  if (error) {
    console.error("reminders: read failed", error);
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }

  const dateKey = fmt("en").instant;
  const due = ((data ?? []) as unknown as Row[]).filter((r) => {
    const tz = r.shops?.timezone ?? "Asia/Baghdad";
    return r.shops && LIVE.includes(r.shops.status) && dateKey(r.starts_at, tz).dateKey === addDays(todayKey(tz, now), 1);
  });
  if (due.length === 0) return NextResponse.json({ due: 0, sent: 0 });

  // Claim the rows first: a parallel run gets none of them.
  const { data: claimed, error: claimError } = await admin
    .from("appointments")
    .update({ reminded_at: now.toISOString() })
    .in("id", due.map((r) => r.id))
    .is("reminded_at", null)
    .select("id");
  if (claimError) {
    console.error("reminders: claim failed", claimError);
    return NextResponse.json({ error: "claim failed" }, { status: 500 });
  }
  const mine = new Set((claimed ?? []).map((c) => c.id as string));

  let sent = 0;
  const undelivered: string[] = [];
  for (const r of due) {
    if (!mine.has(r.id)) continue;
    const userId = r.customers?.user_id;
    // No profile, or no device with alerts on: nothing to send.
    const result = !userId || !r.shops
      ? { sent: 0 }
      : await sendPush(
          [userId],
          customerMessage("reminder", {
            id: r.id, token: r.public_token, shopName: r.shops.name, shopSlug: r.shops.slug,
            timeZone: r.shops.timezone, service: r.service_name, startsAt: r.starts_at,
          }),
        ).catch((err) => {
          console.error("reminders: push failed", r.id, err);
          return { sent: 0 };
        });
    if (result.sent > 0) sent++;
    else undelivered.push(r.id);
  }
  // Keep the mark only where a device got the reminder: the dashboard shows
  // it as «reminded», and a customer who turns alerts on later today still
  // gets one from the next run.
  if (undelivered.length) {
    const { error: resetError } = await admin.from("appointments").update({ reminded_at: null }).in("id", undelivered);
    if (resetError) console.error("reminders: reset failed", resetError);
  }
  return NextResponse.json({ due: due.length, claimed: mine.size, sent });
}
