import { requireSuperAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PLAN_FIELDS } from "@/lib/forms";
import { fill } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import type { Plan } from "@/lib/types";
import { deletePlan, savePlan } from "@/app/[lang]/super/actions";
import { FieldsForm } from "@/components/forms/FieldsForm";
import { ActionButton } from "@/components/ui/ActionButton";

export default async function SuperPlans() {
  const [, { t, f }] = await Promise.all([requireSuperAdmin(), getI18n()]);
  const p = t.super.plans;
  const limit = (n: number | null) => (n == null ? t.common.unlimited : f.num(n));
  const supabase = await createClient();
  const { data } = await supabase.from("plans").select("*").order("sort_order");
  const plans = (data ?? []) as Plan[];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">{t.super.nav.plans}</h1>
        <p className="mt-1 text-sm text-slate-500">{p.help}</p>
      </div>

      <details className="card">
        <summary className="cursor-pointer list-none font-semibold text-brand">＋ {p.newPlan}</summary>
        <div className="mt-4">
          <FieldsForm action={savePlan} fields={PLAN_FIELDS} defaults={{ period_months: 1 }} submitLabel={t.common.create} />
        </div>
      </details>

      {plans.length === 0 && <p className="card text-center text-sm text-slate-500">{p.empty}</p>}

      <ul className="grid gap-4 md:grid-cols-2">
        {plans.map((plan) => (
          <li key={plan.id} className="card space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold">{plan.name} {!plan.is_public && <span className="text-xs text-slate-400">{p.private}</span>}</p>
                <p className="text-lg font-bold text-brand">
                  {f.iqd(plan.price_iqd)} <span className="text-sm font-normal text-slate-500">/ {f.months(plan.period_months)}</span>
                </p>
              </div>
              <ActionButton action={deletePlan.bind(null, plan.id)} confirmText={p.deleteQ} className="btn-danger px-3 py-1.5">
                {t.common.delete}
              </ActionButton>
            </div>
            <p className="text-xs text-slate-500">
              {fill(p.limits, { staff: limit(plan.max_staff), photos: limit(plan.max_gallery_photos), locations: limit(plan.max_locations) })}
            </p>
            <details className="border-t border-slate-100 pt-2">
              <summary className="cursor-pointer text-sm text-brand">{t.common.edit}</summary>
              <div className="mt-3">
                <FieldsForm action={savePlan} fields={PLAN_FIELDS} defaults={{ ...plan }} hidden={{ id: plan.id }} submitLabel={t.common.save} />
              </div>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}
