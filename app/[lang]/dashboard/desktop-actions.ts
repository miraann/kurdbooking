"use server";

import { canManage, requireShop } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getActionI18n } from "@/lib/i18n/request";
import { displayPhone, fill, fmt } from "@/lib/format";

export interface DesktopAlert { id: string; title: string; body: string; url: string }

/**
 * The Windows app can't receive Web Push (WebView2 has no push service), so while it is
 * open it asks every 30 seconds for bookings made since the last check and shows them as
 * Windows notifications (components/push/DesktopAlerts.tsx). `since` = null only fetches the
 * server's clock. Staff logins only get their own bookings, like the push alerts do.
 * Reads as the user, so RLS applies; always filtered by shop_id.
 */
export async function pollNewBookings(since: string | null): Promise<{ now: string; alerts: DesktopAlert[] }> {
  const { lang, t, href } = await getActionI18n();
  const { shop, user, role } = await requireShop();
  const now = new Date().toISOString();
  const sinceDate = since ? new Date(since) : null;
  if (!sinceDate || Number.isNaN(sinceDate.getTime())) return { now, alerts: [] };

  const supabase = await createClient();
  let query = supabase
    .from("appointments")
    .select("id, status, service_name, starts_at, customers(full_name, phone)")
    .eq("shop_id", shop.id)
    .gt("created_at", sinceDate.toISOString())
    .lte("created_at", now)
    .order("created_at", { ascending: true })
    .limit(10);
  if (!canManage(role)) {
    const { data: me } = await supabase.from("staff").select("id").eq("shop_id", shop.id).eq("user_id", user.id).maybeSingle();
    if (!me) return { now, alerts: [] };
    query = query.eq("staff_id", me.id);
  }
  const { data, error } = await query;
  if (error) return { now: sinceDate.toISOString(), alerts: [] }; // try the same window again next time

  const p = t.push;
  const f = fmt(lang);
  const alerts = (data ?? []).map((a) => {
    const at = f.instant(a.starts_at as string, shop.timezone);
    const c = a.customers as unknown as { full_name: string; phone: string | null } | null;
    return {
      id: a.id as string,
      title: a.status === "pending" ? p.newBookingPending : p.newBookingConfirmed,
      body: fill(p.newBookingBody, { name: c?.full_name ?? "", phone: displayPhone(c?.phone), service: (a.service_name as string | null) ?? "", staff: "", date: at.date, time: at.time }),
      url: href(a.status === "pending" ? "/dashboard/appointments?view=pending" : "/dashboard/appointments"),
    };
  });
  return { now, alerts };
}
