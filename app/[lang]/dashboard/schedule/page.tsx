import { requireShop } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/lib/i18n/server";
import type { WorkingHours } from "@/lib/types";
import { saveHours } from "@/app/[lang]/dashboard/actions";
import { HoursForm } from "@/components/dashboard/HoursForm";
import { ResourceEditor } from "@/components/dashboard/ResourceEditor";

export default async function SchedulePage() {
  const [{ shop }, { t }] = await Promise.all([requireShop(), getI18n()]);
  const s = t.dashboard.schedule;
  const supabase = await createClient();
  const { data } = await supabase.from("working_hours").select("*").eq("shop_id", shop.id).is("staff_id", null);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">{s.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{s.help}</p>
      </div>
      <HoursForm hours={(data ?? []) as WorkingHours[]} action={saveHours} />

      <section className="space-y-3">
        <h2 className="text-lg font-bold">{s.daysOff}</h2>
        <p className="text-sm text-slate-500">{s.daysOffHelp}</p>
        <ResourceEditor resource="blocked_dates" />
      </section>
    </div>
  );
}
