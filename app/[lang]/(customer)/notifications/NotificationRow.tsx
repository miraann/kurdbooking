import Link from "next/link";
import { Bell, BellRing, CalendarX, CircleCheck, CircleX, Star, type LucideIcon } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import { eventPath, eventText, waitlistPath, waitlistText, type InboxKind } from "@/lib/customer-push";
import { LogoRing } from "@/components/shop/theme";

export interface Notification {
  id: string;
  kind: InboxKind;
  created_at: string;
  read_at: string | null;
  shop_slug: string;
  shop_name: string;
  shop_logo_url: string | null;
  appointment_id: string | null;
  public_token: string | null;
  service_name: string | null;
  starts_at: string | null;
  for_date: string | null;
  service_id: string | null;
}

// Every shop is in Sulaimani for now (one time zone), as on /account.
const TIME_ZONE = "Asia/Baghdad";

/** The small round badge on the shop logo: what happened, in a colour. */
const KIND: Record<InboxKind, { icon: LucideIcon; tone: string }> = {
  confirmed: { icon: CircleCheck, tone: "bg-emerald-500" },
  declined: { icon: CircleX, tone: "bg-red-500" },
  cancelled: { icon: CalendarX, tone: "bg-red-500" },
  completed: { icon: Star, tone: "bg-amber-400" },
  reminder: { icon: Bell, tone: "bg-sky-500" },
  waitlist: { icon: BellRing, tone: "bg-violet-500" },
};

/** One notification: the shop logo with a coloured «what happened» badge, title, text and when. */
export async function NotificationRow({ n }: { n: Notification }) {
  const { lang, t, f, href } = await getI18n();
  const isWaitlist = n.kind === "waitlist";
  // A row whose booking or day is gone can't be drawn (the database keeps them together; this is only a guard).
  if (isWaitlist ? !n.for_date : !n.starts_at || !n.appointment_id || !n.public_token) return null;

  const text = isWaitlist
    ? waitlistText(lang, n.shop_name, n.for_date!)
    : eventText(n.kind as Exclude<InboxKind, "waitlist">, lang, { shopName: n.shop_name, service: n.service_name, startsAt: n.starts_at!, timeZone: TIME_ZONE });
  const path = isWaitlist
    ? waitlistPath(n.shop_slug, n.for_date!, n.service_id)
    : eventPath(n.kind as Exclude<InboxKind, "waitlist">, { id: n.appointment_id!, shopSlug: n.shop_slug, token: n.public_token! });
  const sent = f.instant(n.created_at, TIME_ZONE);
  const { icon: Icon, tone } = KIND[n.kind];
  const isNew = !n.read_at;

  return (
    <Link
      href={href(path)}
      className={`flex items-start gap-3 rounded-3xl border p-4 shadow-sm transition active:scale-[0.99] ${isNew ? "" : "border-neutral-100 bg-white"}`}
      style={isNew ? { borderColor: "color-mix(in srgb, var(--shop-primary) 25%, white)", background: "color-mix(in srgb, var(--shop-primary) 5%, white)" } : undefined}
    >
      <span className="relative shrink-0">
        <LogoRing logoUrl={n.shop_logo_url} className="size-12" iconClassName="size-5" spin={false} />
        <span className={`absolute -bottom-1 -end-1 grid size-5 place-items-center rounded-full text-white ring-2 ring-white ${tone}`}>
          <Icon className="size-3" strokeWidth={2.6} aria-hidden />
        </span>
      </span>
      <span className="min-w-0 flex-1 space-y-1">
        <span className="flex items-start justify-between gap-2">
          <span className="font-bold leading-snug text-neutral-900">{text.title}</span>
          {isNew && (
            <span className="mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-bold text-white" style={{ background: "var(--shop-accent)" }}>
              {t.notificationsPage.newOne}
            </span>
          )}
        </span>
        <span className="block text-sm leading-relaxed text-neutral-600">{text.body}</span>
        <span className="block text-xs text-neutral-400">{sent.date} · {sent.time}</span>
      </span>
    </Link>
  );
}
