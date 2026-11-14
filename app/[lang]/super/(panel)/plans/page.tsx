import { Pencil, Trash2 } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PLAN_FIELDS } from "@/lib/forms";
import { fill } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import type { Plan } from "@/lib/types";
import { deletePlan, savePlan } from "@/app/[lang]/super/actions";
import { FieldsForm } from "@/components/forms/FieldsForm";
import { ActionButton } from "@/components/ui/ActionButton";
import { AddTile, FormDialog } from "@/components/ui/FormDialog";

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

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <li>
          <AddTile label={p.newPlan} hint={plans.length === 0 ? p.empty : undefined}>
            <FieldsForm action={savePlan} fields={PLAN_FIELDS} defaults={{ period_months: 1 }} submitLabel={t.common.create} />
          </AddTile>
        </li>
        {plans.map((plan) => (
          <li key={plan.id} className="card flex flex-col gap-2">
            <p className="font-bold">{plan.name} {!plan.is_public && <span className="text-xs text-slate-400">{p.private}</span>}</p>
            <p className="text-lg font-bold text-brand">
              {f.iqd(plan.price_iqd)} <span className="text-sm font-normal text-slate-500">/ {f.months(plan.period_months)}</span>
            </p>
            <p className="text-xs text-slate-500">
              {fill(p.limits, { staff: limit(plan.max_staff), photos: limit(plan.max_gallery_photos), locations: limit(plan.max_locations) })}
            </p>
            <div className="mt-auto flex items-start gap-2 border-t border-slate-100 pt-3">
              <FormDialog
                title={`${t.common.edit} · ${plan.name}`}
                triggerClassName="btn-tonal min-h-10 flex-1 py-2"
                trigger={<><Pencil className="size-4" /> {t.common.edit}</>}
              >
                <FieldsForm action={savePlan} fields={PLAN_FIELDS} defaults={{ ...plan }} hidden={{ id: plan.id }} submitLabel={t.common.save} />
              </FormDialog>
              <ActionButton action={deletePlan.bind(null, plan.id)} confirmText={p.deleteQ} className="btn-danger min-h-10 px-3 py-2">
                <Trash2 className="size-4" /><span className="sr-only">{t.common.delete}</span>
              </ActionButton>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
