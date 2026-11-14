import { requireShop } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PROFILE_FIELDS } from "@/lib/forms";
import { displayPhone } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { saveProfile } from "@/app/[lang]/dashboard/actions";
import { FieldsForm } from "@/components/forms/FieldsForm";

export default async function ProfilePage() {
  const [{ shop }, { t }] = await Promise.all([requireShop(["owner", "manager"]), getI18n()]);
  const supabase = await createClient();
  const { data: profile } = await supabase.from("shop_profile").select("*").eq("shop_id", shop.id).maybeSingle();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">{t.dashboard.profile.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{t.dashboard.profile.help}</p>
      </div>
      <div className="card">
        <FieldsForm
          action={saveProfile}
          fields={PROFILE_FIELDS}
          defaults={{
            ...profile,
            name: shop.name,
            phone: displayPhone(profile?.phone),
            whatsapp: displayPhone(profile?.whatsapp),
          }}
          submitLabel={t.common.save}
        />
      </div>
    </div>
  );
}
