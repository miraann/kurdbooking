import { connection } from "next/server";
import Link from "next/link";
import { canManage, requireShop } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { shopUrl } from "@/lib/tenant";
import { addDays, todayKey, zonedToUtc } from "@/lib/booking";
import { getI18n } from "@/lib/i18n/server";
import { APPOINTMENT_STATUS } from "@/lib/labels";
import type { Appointment } from "@/lib/types";
import { ShopQr } from "@/components/dashboard/ShopQr";

export default async function DashboardHome() {
  await connection(); // uses the current time below, so never prerender this page
  const [{ shop, role }, { lang, t, f, href }] = await Promise.all([requireShop(), getI18n()]);
  const h = t.dashboard.home;
  const supabase = await createClient();
  const today = todayKey(shop.timezone);
  const dayStart = zonedToUtc(today, "00:00", shop.timezone).toISOString();
  const dayEnd = zonedToUtc(addDays(today, 1), "00:00", shop.timezone).toISOString();

  const [{ data: todays }, { count: pending }, { count: services }] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, starts_at, status, service_name, customers(full_name)")
      .eq("shop_id", shop.id)
      .gte("starts_at", dayStart)
      .lt("starts_at", dayEnd)
      .in("status", ["pending", "confirmed", "completed"])
      .order("starts_at"),
    supabase.from("appointments").select("id", { count: "exact", head: true })
      .eq("shop_id", shop.id).eq("status", "pending").gte("starts_at", new Date().toISOString()),
    supabase.from("services").select("id", { count: "exact", head: true }).eq("shop_id", shop.id),
  ]);

  const list = (todays ?? []) as unknown as (Pick<Appointment, "id" | "starts_at" | "status" | "service_name"> & {
    customers: { full_name: string } | null;
  })[];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Stat label={h.todayCount} value={f.num(list.length)} href={href("/dashboard/appointments")} />
        <Stat label={h.pendingCount} value={f.num(pending ?? 0)} href={href("/dashboard/appointments?view=pending")} highlight={!!pending} />
      </div>

      {services === 0 && canManage(role) && (
        <div className="card-emphasized">
          <p className="font-semibold">{h.firstStepTitle}</p>
          <p className="mt-1 text-sm text-slate-600">{h.firstStepText}</p>
          <Link href={href("/dashboard/services")} className="btn-primary mt-3">{h.addService}</Link>
        </div>
      )}

      <section className="card">
        <h2 className="mb-3 font-bold">{h.today}</h2>
        {list.length === 0 ? (
          <p className="text-sm text-slate-500">{h.noneToday}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {list.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="font-semibold">{f.instant(a.starts_at, shop.timezone).time}</span>
                <span className="min-w-0 flex-1 truncate">{a.customers?.full_name} · {a.service_name}</span>
                <span className="text-xs text-slate-500">{APPOINTMENT_STATUS[a.status][lang]}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2 className="mb-3 font-bold">{h.shopLink}</h2>
        <ShopQr url={shopUrl(shop.slug)} />
      </section>
    </div>
  );
}

function Stat({ label, value, href, highlight }: { label: string; value: string; href: string; highlight?: boolean }) {
  return (
    <Link href={href} className={`card block transition hover:shadow-md ${highlight ? "ring-2 ring-indigo-300" : ""}`}>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-brand">{value}</p>
    </Link>
  );
}
