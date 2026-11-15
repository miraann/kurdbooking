import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPush } from "@/lib/push";
import { fill, fmt } from "@/lib/format";
import { localePath } from "@/lib/i18n/config";
import { DICTS } from "@/lib/i18n/dictionaries";

// The waitlist (0016): when a booking is cancelled, everyone waiting for that
// day at that shop gets a push that opens the booking page on that day. The
// first to book gets the time; nothing is held for anyone.

const LIVE = ["trial", "active", "past_due"];
/** Someone told within this many minutes isn't told again (several cancellations in a row). */
const QUIET_MINUTES = 10;

export async function notifyWaitlist(freed: { shopId: string; staffId: string; startsAt: string }): Promise<number> {
  if (Date.parse(freed.startsAt) <= Date.now()) return 0; // a past time helps nobody
  const admin = createAdminClient();
  const { data: shop } = await admin.from("shops").select("name, slug, timezone, status").eq("id", freed.shopId).maybeSingle();
  if (!shop || !LIVE.includes(shop.status)) return 0;
  const dateKey = fmt("en").instant(freed.startsAt, shop.timezone).dateKey;
  const quiet = new Date(Date.now() - QUIET_MINUTES * 60_000).toISOString();

  const { data, error } = await admin
    .from("waitlist")
    .select("id, user_id, service_id, staff_id")
    .eq("shop_id", freed.shopId)
    .eq("date", dateKey)
    .or(`notified_at.is.null,notified_at.lt.${quiet}`);
  if (error) throw error;
  // Waiting for anyone, or for the person whose time opened.
  const waiting = (data ?? []).filter((w) => !w.staff_id || w.staff_id === freed.staffId);
  if (waiting.length === 0) return 0;

  await admin.from("waitlist").update({ notified_at: new Date().toISOString() }).in("id", waiting.map((w) => w.id));
  await Promise.all(
    waiting.map((w) =>
      sendPush([w.user_id as string], (lang) => {
        const p = DICTS[lang].push;
        const query = `date=${dateKey}${w.service_id ? `&service=${w.service_id}` : ""}`;
        return {
          title: fill(p.waitlistTitle, { shop: shop.name }),
          body: fill(p.waitlistBody, { date: fmt(lang).date(dateKey) }),
          url: localePath(lang, `/s/${shop.slug}/book?${query}`),
          tag: `waitlist-${freed.shopId}-${dateKey}`,
        };
      }).catch((err) => console.error("waitlist push failed", err)),
    ),
  );
  return waiting.length;
}
