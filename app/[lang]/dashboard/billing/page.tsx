import { MessageCircle } from "lucide-react";
import { requireShop } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { fill, whatsappLink } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { PAYMENT_METHOD, SHOP_STATUS } from "@/lib/labels";
import type { Payment, Plan } from "@/lib/types";

export default async function BillingPage() {
  const [{ shop, role }, { lang, t, f }] = await Promise.all([requireShop(), getI18n()]);
  const b = t.dashboard.billing;
  const supabase = await createClient();

  const [{ data: payments }, { data: plans }, { data: settings }, { data: currentPlan }] = await Promise.all([
    role === "owner"
      ? supabase.from("payments").select("*").eq("shop_id", shop.id).order("paid_at", { ascending: false })
      : Promise.resolve({ data: [] as Payment[] }),
    supabase.from("plans").select("*").eq("is_public", true).order("sort_order"),
    supabase.from("platform_settings").select("support_whatsapp").maybeSingle(),
    // The shop's plan may be private (not on /pricing), so read it with the secret key.
    shop.plan_id
      ? createAdminClient().from("plans").select("name, price_iqd, period_months").eq("id", shop.plan_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const support = settings?.support_whatsapp || env.supportWhatsapp();
  const message = fill(b.message, { name: shop.name, slug: shop.slug });

  return (
    <div className="space-y-6">
      <h1 className="page-title">{b.title}</h1>

      <section className="card grid gap-4 sm:grid-cols-3">
        <Info label={b.status} value={SHOP_STATUS[shop.status][lang]} />
        <Info label={b.plan} value={currentPlan?.name ?? (shop.status === "trial" ? b.trial : "—")} />
        <Info
          label={shop.status === "trial" ? b.trialEnds : b.paidUntil}
          value={f.shortDate(shop.status === "trial" ? shop.trial_ends_at : shop.paid_until, shop.timezone)}
        />
      </section>

      {support && (
        <a href={whatsappLink(support, message)} target="_blank" rel="noreferrer" className="btn-primary w-full sm:w-auto">
          <MessageCircle className="size-5" aria-hidden /> {b.contact}
        </a>
      )}

      {(plans as Plan[] | null)?.length ? (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">{b.plans}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {(plans as Plan[]).map((p) => (
              <div key={p.id} className={`card ${p.id === shop.plan_id ? "ring-2 ring-indigo-300" : ""}`}>
                <p className="font-bold">{p.name}</p>
                <p className="mt-1 text-xl font-bold text-brand">
                  {f.iqd(p.price_iqd)} <span className="text-sm font-normal text-slate-500">/ {f.months(p.period_months)}</span>
                </p>
                {p.description && <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{p.description}</p>}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {role === "owner" && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">{b.payments}</h2>
          {!payments?.length ? (
            <p className="card text-sm text-slate-500">{b.noPayments}</p>
          ) : (
            <ul className="card divide-y divide-slate-100">
              {(payments as Payment[]).map((p) => (
                <li key={p.id} className="flex flex-wrap justify-between gap-2 py-2.5 text-sm">
                  <span>{f.shortDate(p.paid_at, shop.timezone)}</span>
                  <span className="font-semibold">{f.iqd(p.amount_iqd)}</span>
                  <span className="text-slate-500">{PAYMENT_METHOD[p.method][lang]} · {f.months(p.months)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-bold">{value}</p>
    </div>
  );
}
