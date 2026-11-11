import Link from "next/link";
import { MessageCircle, Phone } from "lucide-react";
import { requireShop } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { shopUrl } from "@/lib/tenant";
import { displayPhone, fillTemplate, whatsappLink } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { APPOINTMENT_STATUS } from "@/lib/labels";
import type { Appointment, AppointmentStatus, WhatsAppTemplate } from "@/lib/types";
import { setAppointmentStatus } from "@/app/[lang]/dashboard/actions";
import { ActionButton } from "@/components/ui/ActionButton";

const VIEWS = ["upcoming", "pending", "past"] as const;
type View = (typeof VIEWS)[number];

type Row = Appointment & {
  customers: { full_name: string; phone: string } | null;
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
  const view: View = rawView === "pending" || rawView === "past" ? rawView : "upcoming";
  const [{ shop }, { lang, t, f, href }] = await Promise.all([requireShop(), getI18n()]);
  const ta = t.dashboard.appointments;
  const supabase = await createClient();
  const now = new Date().toISOString();

  let query = supabase
    .from("appointments")
    .select("*, customers(full_name, phone), staff(name)")
    .eq("shop_id", shop.id)
    .limit(200);
  if (view === "past") query = query.lt("starts_at", now).order("starts_at", { ascending: false });
  else {
    query = query.gte("starts_at", now).order("starts_at", { ascending: true });
    query = view === "pending" ? query.eq("status", "pending") : query.in("status", ["pending", "confirmed"]);
  }

  const [{ data, error }, { data: templates }] = await Promise.all([
    query,
    supabase.from("whatsapp_templates").select("*").eq("shop_id", shop.id).order("sort_order"),
  ]);
  if (error) throw error;
  const rows = (data ?? []) as unknown as Row[];
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

      <nav className="flex gap-2">
        {VIEWS.map((v) => (
          <Link key={v} href={href(`/dashboard/appointments?view=${v}`)} className={v === view ? "btn-primary px-3 py-1.5" : "btn-ghost px-3 py-1.5"}>
            {ta[v]}
          </Link>
        ))}
      </nav>

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
                    <p className="font-semibold">{a.customers?.full_name}</p>
                    <p className="text-sm text-slate-500">
                      {a.service_name ?? "—"}{a.staff?.name ? ` · ${a.staff.name}` : ""}
                    </p>
                    {a.customer_note && <p className="mt-1 text-sm text-slate-600">«{a.customer_note}»</p>}
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[a.status]}`}>
                    {APPOINTMENT_STATUS[a.status][lang]}
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
                        <MessageCircle className="size-4" aria-hidden /> {t.common.whatsapp}
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
