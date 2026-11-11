import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { daysUntil } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { SHOP_STATUS } from "@/lib/labels";
import type { Shop, ShopStatus } from "@/lib/types";
import { pushPublicKey } from "@/lib/push";
import { PushAlerts } from "@/components/super/PushAlerts";

export default async function SuperHome() {
  const [, { lang, t, f, href }] = await Promise.all([requireSuperAdmin(), getI18n()]);
  const h = t.super.home;
  const supabase = await createClient();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [{ data: shops }, { data: payments }, { count: newRequests }, publicKey] = await Promise.all([
    supabase.from("shops").select("id, name, slug, status, trial_ends_at, paid_until, timezone"),
    supabase.from("payments").select("amount_iqd").gte("paid_at", monthStart.toISOString()),
    supabase.from("shop_requests").select("id", { count: "exact", head: true }).eq("status", "new"),
    pushPublicKey(),
  ]);
  const all = (shops ?? []) as Pick<Shop, "id" | "name" | "slug" | "status" | "trial_ends_at" | "paid_until" | "timezone">[];

  const byStatus = (s: ShopStatus) => all.filter((x) => x.status === s).length;
  const income = (payments ?? []).reduce((sum, p) => sum + (p.amount_iqd as number), 0);
  const expiring = all
    .filter((s) => s.status === "trial" || s.status === "active" || s.status === "past_due")
    .map((s) => ({ ...s, endsAt: s.status === "active" ? s.paid_until : s.trial_ends_at }))
    .filter((s) => s.endsAt && daysUntil(s.endsAt) <= 7)
    .sort((a, b) => Date.parse(a.endsAt!) - Date.parse(b.endsAt!));

  return (
    <div className="space-y-6">
      <h1 className="page-title">{t.super.nav.home}</h1>
      {!!newRequests && (
        <Link href={href("/super/requests")} className="card-emphasized flex items-center justify-between gap-3 p-4">
          <span className="font-semibold text-indigo-700">{h.newRequests}</span>
          <span className="text-2xl font-bold text-brand">{f.num(newRequests)}</span>
        </Link>
      )}
      <PushAlerts publicKey={publicKey} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label={h.allShops} value={f.num(all.length)} />
        <Stat label={SHOP_STATUS.active[lang]} value={f.num(byStatus("active"))} />
        <Stat label={SHOP_STATUS.trial[lang]} value={f.num(byStatus("trial"))} />
        <Stat label={h.lateSuspended} value={f.num(byStatus("past_due") + byStatus("suspended"))} />
        <Stat label={h.income} value={f.iqd(income)} />
      </div>

      <section className="card">
        <h2 className="mb-3 font-bold">{h.expiring}</h2>
        {expiring.length === 0 ? (
          <p className="text-sm text-slate-500">{t.common.nothing}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {expiring.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <Link href={href(`/super/shops/${s.id}`)} className="font-semibold text-brand">{s.name}</Link>
                <span className="text-slate-500">{SHOP_STATUS[s.status][lang]}</span>
                <span>{f.shortDate(s.endsAt, s.timezone)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-brand">{value}</p>
    </div>
  );
}
