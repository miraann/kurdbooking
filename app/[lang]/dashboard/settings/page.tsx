import { requireShop } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { APP_FIELDS, BOOKING_FIELDS } from "@/lib/forms";
import { getI18n } from "@/lib/i18n/server";
import { saveAppListing, saveBookingSettings } from "@/app/[lang]/dashboard/actions";
import { FieldsForm } from "@/components/forms/FieldsForm";
import { ResourceEditor } from "@/components/dashboard/ResourceEditor";
import { PushAlerts } from "@/components/push/PushAlerts";
import { PasswordForm } from "@/components/forms/PasswordForm";
import { pushPublicKey } from "@/lib/push";

export default async function SettingsPage() {
  const [{ shop, user }, { t }] = await Promise.all([requireShop(), getI18n()]);
  const s = t.dashboard.settings;
  const supabase = await createClient();
  const [{ data: profile }, publicKey] = await Promise.all([
    supabase
      .from("shop_profile")
      .select("booking_enabled, auto_confirm, slot_interval_minutes, min_notice_minutes, max_days_ahead")
      .eq("shop_id", shop.id)
      .maybeSingle(),
    pushPublicKey(),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="page-title">{s.title}</h1>

      <PushAlerts publicKey={publicKey} />

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

      <section className="space-y-3">
        <h2 className="text-lg font-bold">{t.password.changeTitle}</h2>
        <p className="text-sm text-slate-500">{t.password.changeHelp}</p>
        <PasswordForm mode="change" email={user.email} className="card max-w-xl space-y-4" />
      </section>
    </div>
  );
}
