import { requireShop } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { APP_FIELDS, BOOKING_FIELDS } from "@/lib/forms";
import { getI18n } from "@/lib/i18n/server";
import { saveAppListing, saveBookingSettings } from "@/app/[lang]/dashboard/actions";
import { FieldsForm } from "@/components/forms/FieldsForm";
import { ResourceEditor } from "@/components/dashboard/ResourceEditor";

export default async function SettingsPage() {
  const [{ shop }, { t }] = await Promise.all([requireShop(), getI18n()]);
  const s = t.dashboard.settings;
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("shop_profile")
    .select("booking_enabled, auto_confirm, slot_interval_minutes, min_notice_minutes, max_days_ahead")
    .eq("shop_id", shop.id)
    .maybeSingle();

  return (
    <div className="space-y-8">
      <h1 className="page-title">{s.title}</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">{s.booking}</h2>
        <div className="card">
          <FieldsForm action={saveBookingSettings} fields={BOOKING_FIELDS} defaults={profile ?? undefined} submitLabel={t.common.save} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">{s.app}</h2>
        <div className="card space-y-3">
          {shop.hidden_by_admin && <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">{s.hiddenByAdmin}</p>}
          <FieldsForm action={saveAppListing} fields={APP_FIELDS} defaults={{ listed: shop.listed }} submitLabel={s.appSave} columns={1} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">{s.templates}</h2>
        <p className="text-sm text-slate-500">{s.templatesHelp}</p>
        <ResourceEditor resource="whatsapp_templates" />
      </section>
    </div>
  );
}
