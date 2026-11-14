import { connection } from "next/server";
import Link from "next/link";
import { Ban, BellRing, MessageCircle, Phone } from "lucide-react";
import { canManage, requireShop } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { shopUrl } from "@/lib/tenant";
import { addDays, todayKey, zonedToUtc } from "@/lib/booking";
import { displayPhone, fill, fillTemplate, whatsappLink } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { APPOINTMENT_STATUS } from "@/lib/labels";
import type { Appointment, AppointmentStatus, WhatsAppTemplate } from "@/lib/types";
import { setAppointmentStatus, setCustomerBlocked } from "@/app/[lang]/dashboard/actions";
import { ActionButton } from "@/components/ui/ActionButton";

const VIEWS = ["upcoming", "pending", "tomorrow", "past"] as const;
type View = (typeof VIEWS)[number];

type Row = Appointment & {
  reminded_at: string | null;
  customers: { id: string; full_name: string; phone: string; blocked_at: string | null } | null;
  staff: { name: string } | null;
};

const STATUS_STYLE: Record<AppointmentStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-slate-100 text-slate-500",
  completed: "bg-brand-soft text-brand",
  no_show: "bg-rose-100 text-rose-700",
};

export default async function AppointmentsPage({ searchParams }: PageProps<"/[lang]/dashboard/appointments">) {
  const { view: rawView } = await searchParams;
  const view: View = VIEWS.find((v) => v === rawView) ?? "upcoming";
  await connection(); // uses the current time below, so never prerender this page
  const [{ shop, role }, { lang, t, f, href }] = await Promise.all([requireShop(), getI18n()]);
  const manager = canManage(role);
  const ta = t.dashboard.appointments;
  const supabase = await createClient();
  const now = new Date().toISOString();

  let query = supabase
    .from("appointments")
    .select("*, customers(id, full_name, phone, blocked_at), staff(name)")
    .eq("shop_id", shop.id)
    .limit(200);
  if (view === "past") query = query.lt("starts_at", now).order("starts_at", { ascending: false });
  else if (view === "tomorrow") {
    // Tomorrow in the shop's time zone, for the day-before WhatsApp reminders.
    const day = addDays(todayKey(shop.timezone), 1);
    query = query
      .gte("starts_at", zonedToUtc(day, "00:00", shop.timezone).toISOString())
      .lt("starts_at", zonedToUtc(addDays(day, 1), "00:00", shop.timezone).toISOString())
      .in("status", ["pending", "confirmed"])
      .order("starts_at", { ascending: true });
  } else {
    query = query.gte("starts_at", now).order("starts_at", { ascending: true });
    query = view === "pending" ? query.eq("status", "pending") : query.in("status", ["pending", "confirmed"]);
  }

  const [{ data, error }, { data: templates }] = await Promise.all([
    query,
    supabase.from("whatsapp_templates").select("*").eq("shop_id", shop.id).order("sort_order"),
  ]);
  if (error) throw error;
  const rows = (data ?? []) as unknown as Row[];
  // No-shows per customer, so the owner sees who keeps not coming (block after 2–3).
  const customerIds = [...new Set(rows.map((r) => r.customer_id))];
  const noShows = new Map<string, number>();
  if (customerIds.length) {
    const { data: missed } = await supabase
      .from("appointments")
      .select("customer_id")
      .eq("shop_id", shop.id)
      .eq("status", "no_show")
      .in("customer_id", customerIds);
    for (const m of missed ?? []) noShows.set(m.customer_id, (noShows.get(m.customer_id) ?? 0) + 1);
  }
  const firstOf = (kind: WhatsAppTemplate["kind"]) => (templates as WhatsAppTemplate[] | null)?.find((t) => t.kind === kind);

  // Group by day in the shop's time zone.
  const groups = new Map<string, { label: string; items: Row[] }>();
  for (const r of rows) {
    const { dateKey, date } = f.instant(r.starts_at, shop.timezone);
    if (!groups.has(dateKey)) groups.set(dateKey, { label: date, items: [] });
    groups.get(dateKey)!.items.push(r);
  }

  return (
    <div className="space-y-5">
      <h1 className="page-title">{ta.title}</h1>

      <nav className="flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <Link key={v} href={href(`/dashboard/appointments?view=${v}`)} className={v === view ? "btn-primary px-3 py-1.5" : "btn-ghost px-3 py-1.5"}>
            {ta[v]}
          </Link>
        ))}
      </nav>

      {view === "tomorrow" && <p className="text-sm text-slate-500">{ta.tomorrowHelp}</p>}

      {groups.size === 0 && <p className="card text-center text-sm text-slate-500">{ta.empty}</p>}

      {[...groups.entries()].map(([key, group]) => (
        <section key={key} className="space-y-3">
          <h2 className="text-sm font-bold text-slate-500">{group.label}</h2>
          {group.items.map((a) => {
            const { time, date } = f.instant(a.starts_at, shop.timezone);
            const phone = a.customers?.phone ?? "";
            const vars = { name: a.customers?.full_name ?? "", shop: shop.name, date, time, link: shopUrl(shop.slug, "/book") };
            const wa = (kind: WhatsAppTemplate["kind"]) => {
              const t = firstOf(kind);
              return t ? whatsappLink(phone, fillTemplate(t.body, vars)) : whatsappLink(phone);
            };
            return (
              <article key={a.id} className="card space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-lg font-bold">{time}</p>
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      {a.customers?.full_name}
                      {a.customers?.blocked_at && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700">
                          <Ban className="size-3" aria-hidden /> {ta.blocked}
                        </span>
                      )}
                      {(noShows.get(a.customer_id) ?? 0) >= 2 && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                          {fill(ta.noShows, { n: f.num(noShows.get(a.customer_id) ?? 0) })}
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-slate-500">
                      {a.service_name ?? "—"}{a.staff?.name ? ` · ${a.staff.name}` : ""}
                    </p>
                    {a.customer_note && <p className="mt-1 text-sm text-slate-600">«{a.customer_note}»</p>}
                  </div>
                  <span className="flex flex-col items-end gap-1">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[a.status]}`}>
                      {APPOINTMENT_STATUS[a.status][lang]}
                    </span>
                    {a.reminded_at && a.status === "confirmed" && (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                        <BellRing className="size-3" aria-hidden /> {ta.reminded}
                      </span>
                    )}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {a.status === "pending" && (
                    <>
                      <ActionButton action={setAppointmentStatus.bind(null, a.id, "confirmed")} className="btn-primary px-3 py-1.5">{ta.confirm}</ActionButton>
                      <ActionButton action={setAppointmentStatus.bind(null, a.id, "cancelled")} confirmText={ta.declineQ} className="btn-danger px-3 py-1.5">{ta.decline}</ActionButton>
                    </>
                  )}
                  {a.status === "confirmed" && (
                    <>
                      <ActionButton action={setAppointmentStatus.bind(null, a.id, "completed")} className="btn-ghost px-3 py-1.5">{ta.done}</ActionButton>
                      <ActionButton action={setAppointmentStatus.bind(null, a.id, "no_show")} className="btn-ghost px-3 py-1.5">{ta.noShow}</ActionButton>
                      <ActionButton action={setAppointmentStatus.bind(null, a.id, "cancelled")} confirmText={ta.cancelQ} className="btn-danger px-3 py-1.5">{ta.cancel}</ActionButton>
                    </>
                  )}
                  {manager && a.customers && (
                    a.customers.blocked_at ? (
                      <ActionButton action={setCustomerBlocked.bind(null, a.customers.id, false)} className="btn-ghost px-3 py-1.5">
                        {ta.unblock}
                      </ActionButton>
                    ) : (
                      (a.status === "no_show" || (noShows.get(a.customer_id) ?? 0) >= 2) && (
                        <ActionButton action={setCustomerBlocked.bind(null, a.customers.id, true)} confirmText={ta.blockQ} className="btn-ghost px-3 py-1.5 text-rose-700">
                          <Ban className="size-4" aria-hidden /> {ta.block}
                        </ActionButton>
                      )
                    )
                  )}
                  {phone && (
                    <span className="ms-auto flex gap-2">
                      <a href={`tel:${displayPhone(phone)}`} className="btn-ghost px-3 py-1.5" aria-label={t.common.call}>
                        <Phone className="size-4" aria-hidden />
                      </a>
                      <a
                        href={wa(a.status === "cancelled" ? "decline" : a.status === "pending" ? "accept" : "reminder")}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-ghost px-3 py-1.5 text-emerald-700"
                      >
                        <MessageCircle className="size-4" aria-hidden /> {view === "tomorrow" ? ta.remind : t.common.whatsapp}
                      </a>
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      ))}
    </div>
  );
}
