import { requireSuperAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PLATFORM_SETTINGS_FIELDS } from "@/lib/forms";
import { displayPhone } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { saveSettings } from "@/app/[lang]/super/actions";
import { FieldsForm } from "@/components/forms/FieldsForm";

export default async function SuperSettings() {
  const [, { t }] = await Promise.all([requireSuperAdmin(), getI18n()]);
  const supabase = await createClient();
  const { data } = await supabase.from("platform_settings").select("trial_days, grace_days, support_whatsapp").maybeSingle();

  return (
    <div className="space-y-5">
      <h1 className="page-title">{t.super.settings.title}</h1>
      <div className="card max-w-xl">
        <FieldsForm
          action={saveSettings}
          fields={PLATFORM_SETTINGS_FIELDS}
          defaults={{ ...data, support_whatsapp: displayPhone(data?.support_whatsapp) }}
          submitLabel={t.common.save}
          columns={1}
        />
      </div>
    </div>
  );
}
