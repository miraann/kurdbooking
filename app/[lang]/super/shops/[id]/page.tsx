import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { shopUrl } from "@/lib/tenant";
import { PAYMENT_FIELDS, TRIAL_FIELDS } from "@/lib/forms";
import { displayPhone, whatsappLink } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { PAYMENT_METHOD, SHOP_KIND, SHOP_STATUS } from "@/lib/labels";
import type { Payment, Plan, Review, Shop } from "@/lib/types";
import { extendTrial, recordPayment, setReviewHidden, setShopHidden, setShopStatus } from "@/app/[lang]/super/actions";
import { FieldsForm } from "@/components/forms/FieldsForm";
import { ActionButton } from "@/components/ui/ActionButton";
import { Stars } from "@/components/ui/Stars";

export default async function SuperShopDetail({ params }: PageProps<"/[lang]/super/shops/[id]">) {
  const [, { lang, t, f }] = await Promise.all([requireSuperAdmin(), getI18n()]);
  const ts = t.super.shop;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();

  const [{ data: shop }, { data: profile }, { data: payments }, { data: plans }, { data: reviewRows }] = await Promise.all([
    supabase.from("shops").select("*").eq("id", id).maybeSingle(),
    supabase.from("shop_profile").select("phone, whatsapp").eq("shop_id", id).maybeSingle(),
    supabase.from("payments").select("*").eq("shop_id", id).order("paid_at", { ascending: false }),
    supabase.from("plans").select("id, name, price_iqd, period_months").order("sort_order"),
    supabase.from("reviews").select("*").eq("shop_id", id).order("created_at", { ascending: false }).limit(100),
  ]);
  if (!shop) notFound();
  const s = shop as Shop;

  const owner = s.owner_id ? (await createAdminClient().auth.admin.getUserById(s.owner_id)).data.user : null;
  const planList = (plans ?? []) as Pick<Plan, "id" | "name" | "price_iqd" | "period_months">[];
  const phone = profile?.whatsapp || profile?.phone;
  const reviews = (reviewRows ?? []) as Review[];
  const appState = s.hidden_by_admin ? ts.appHidden : s.listed ? ts.appShown : ts.appOwnerOff;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">{s.name}</h1>
          <a href={shopUrl(s.slug)} target="_blank" rel="noreferrer" className="text-sm text-brand" dir="ltr">{shopUrl(s.slug)}</a>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton action={setShopHidden.bind(null, s.id, !s.hidden_by_admin)} className="btn-ghost">
            {s.hidden_by_admin ? ts.showInApp : ts.hideFromApp}
          </ActionButton>
          {s.status !== "suspended" && (
            <ActionButton action={setShopStatus.bind(null, s.id, s.slug, "suspended")} confirmText={ts.suspendQ} className="btn-danger">
              {ts.suspend}
            </ActionButton>
          )}
          {s.status !== "cancelled" && (
            <ActionButton action={setShopStatus.bind(null, s.id, s.slug, "cancelled")} confirmText={ts.cancelQ} className="btn-ghost">
              {ts.cancel}
            </ActionButton>
          )}
        </div>
      </div>

      <section className="card grid gap-4 sm:grid-cols-3">
        <Info label={t.super.shops.status} value={SHOP_STATUS[s.status][lang]} />
        <Info label={t.super.shops.kind} value={SHOP_KIND[s.kind][lang]} />
        <Info label={ts.plan} value={planList.find((p) => p.id === s.plan_id)?.name ?? "—"} />
        <Info label={ts.trialEnds} value={f.shortDate(s.trial_ends_at, s.timezone)} />
        <Info label={ts.paidUntil} value={f.shortDate(s.paid_until, s.timezone)} />
        <Info label={t.super.shops.created} value={f.shortDate(s.created_at, s.timezone)} />
        <Info label={ts.owner} value={owner?.email ?? "—"} ltr />
        <Info label={ts.mobile} value={displayPhone(phone) || "—"} ltr />
        <Info label={ts.app} value={appState} />
        {phone && (
          <a href={whatsappLink(phone)} target="_blank" rel="noreferrer" className="btn-ghost self-end">{ts.whatsappOwner}</a>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card space-y-3">
          <h2 className="font-bold">{ts.recordPayment}</h2>
          <p className="text-sm text-slate-500">{ts.recordHelp}</p>
          <FieldsForm
            action={recordPayment.bind(null, s.id, s.slug)}
            fields={PAYMENT_FIELDS(planList)}
            defaults={{ months: 1, method: "cash", plan_id: s.plan_id ?? planList[0]?.id, amount_iqd: planList.find((p) => p.id === s.plan_id)?.price_iqd }}
            submitLabel={ts.record}
          />
        </section>

        <section className="card space-y-3">
          <h2 className="font-bold">{ts.extendTrial}</h2>
          <p className="text-sm text-slate-500">{ts.extendHelp}</p>
          <FieldsForm
            action={extendTrial.bind(null, s.id, s.slug)}
            fields={TRIAL_FIELDS}
            defaults={{ days: 7 }}
            submitLabel={ts.extend}
            columns={1}
          />
        </section>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">{ts.reviews}</h2>
        {reviews.length === 0 ? (
          <p className="card text-sm text-slate-500">{ts.noReviews}</p>
        ) : (
          <ul className="card divide-y divide-slate-100">
            {reviews.map((r) => (
              <li key={r.id} className={`flex flex-wrap items-start justify-between gap-3 py-3 ${r.is_hidden ? "opacity-60" : ""}`}>
                <div className="min-w-0 flex-1 space-y-1 text-sm">
                  <p className="flex flex-wrap items-center gap-2">
                    <Stars rating={r.rating} />
                    <span className="font-semibold">{r.reviewer_name || "—"}</span>
                    <span className="text-xs text-slate-400">{f.shortDate(r.created_at, s.timezone)}</span>
                    {r.is_hidden && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{t.dashboard.reviews.hidden}</span>}
                  </p>
                  {r.body && <p className="whitespace-pre-line text-slate-700">{r.body}</p>}
                  {r.reply && <p className="whitespace-pre-line text-slate-500">↳ {r.reply}</p>}
                </div>
                <ActionButton action={setReviewHidden.bind(null, r.id, s.id, !r.is_hidden)} className="btn-ghost px-3 py-1.5">
                  {r.is_hidden ? ts.showReview : ts.hideReview}
                </ActionButton>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">{t.dashboard.billing.payments}</h2>
        {!payments?.length ? (
          <p className="card text-sm text-slate-500">{ts.noPayments}</p>
        ) : (
          <ul className="card divide-y divide-slate-100">
            {(payments as Payment[]).map((p) => (
              <li key={p.id} className="flex flex-wrap justify-between gap-2 py-2.5 text-sm">
                <span>{f.shortDate(p.paid_at, s.timezone)}</span>
                <span className="font-semibold">{f.iqd(p.amount_iqd)}</span>
                <span>{PAYMENT_METHOD[p.method][lang]} · {f.months(p.months)}</span>
                <span className="text-slate-500">{f.shortDate(p.period_start, s.timezone)} – {f.shortDate(p.period_end, s.timezone)}</span>
                {p.reference && <span className="text-slate-400" dir="ltr">{p.reference}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Info({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-semibold" dir={ltr ? "ltr" : undefined}>{value}</p>
    </div>
  );
}
