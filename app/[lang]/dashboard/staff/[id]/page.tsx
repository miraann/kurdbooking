import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, UserRound } from "lucide-react";
import { z } from "zod";
import { requireShop } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getI18n } from "@/lib/i18n/server";
import type { Field } from "@/lib/fields";
import type { Service, Staff, WorkingHours } from "@/lib/types";
import { followShopHours, saveStaffHours, saveStaffServices } from "@/app/[lang]/dashboard/actions";
import { FieldsForm } from "@/components/forms/FieldsForm";
import { HoursForm } from "@/components/dashboard/HoursForm";
import { ActionButton } from "@/components/ui/ActionButton";
import { StaffLogin } from "@/components/dashboard/StaffLogin";

// One staff member: which services they do, their own weekly hours, and
// their own login. No staff_services rows = every service; no own
// working_hours rows = the shop's hours (lib/availability.server.ts reads both).
export default async function StaffDetailPage({ params }: PageProps<"/[lang]/dashboard/staff/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [{ shop }, { t, f, href }] = await Promise.all([requireShop(["owner", "manager"]), getI18n()]);
  const d = t.dashboard.staffDetail;
  const supabase = await createClient();

  const [staffRes, servicesRes, linksRes, hoursRes] = await Promise.all([
    supabase.from("staff").select("*").eq("shop_id", shop.id).eq("id", id).maybeSingle(),
    supabase.from("services").select("id, name, duration_minutes, is_active").eq("shop_id", shop.id).order("sort_order"),
    supabase.from("staff_services").select("service_id").eq("shop_id", shop.id).eq("staff_id", id),
    supabase.from("working_hours").select("*").eq("shop_id", shop.id).or(`staff_id.is.null,staff_id.eq.${id}`),
  ]);
  const staff = staffRes.data as Staff | null;
  if (!staff) notFound();
  const services = (servicesRes.data ?? []) as Pick<Service, "id" | "name" | "duration_minutes" | "is_active">[];
  const linked = new Set((linksRes.data ?? []).map((l) => l.service_id as string));
  const hours = (hoursRes.data ?? []) as WorkingHours[];
  const own = hours.filter((h) => h.staff_id === id);
  const shopHours = hours.filter((h) => h.staff_id === null);

  // One switch per service; all on when nothing is linked yet.
  const serviceFields: Field[] = services.map((s) => ({
    name: `svc_${s.id}`,
    label: `${s.name} · ${f.minutes(s.duration_minutes)}${s.is_active ? "" : ` (${t.common.inactive})`}`,
    type: "checkbox",
  }));
  const serviceDefaults = Object.fromEntries(services.map((s) => [`svc_${s.id}`, linked.size === 0 || linked.has(s.id)]));

  // Their login, if any: the email (auth needs the secret key) and whether it
  // is a 'staff' login of this shop (the owner's own row is linked too).
  let login: { email: string; staffRole: boolean } | null = null;
  if (staff.user_id) {
    const admin = createAdminClient();
    const [{ data: user }, { data: member }] = await Promise.all([
      admin.auth.admin.getUserById(staff.user_id),
      admin.from("shop_members").select("role").eq("shop_id", shop.id).eq("user_id", staff.user_id).maybeSingle(),
    ]);
    login = { email: user.user?.email ?? "", staffRole: member?.role === "staff" };
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Link href={href("/dashboard/staff")} className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600">
          <ChevronLeft className="size-4 rotate-180 ltr:rotate-0" aria-hidden /> {t.dashboard.staff.title}
        </Link>
        <div className="flex items-center gap-4">
          {staff.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={staff.photo_url} alt="" className="size-16 rounded-full object-cover" />
          ) : (
            <span className="grid size-16 place-items-center rounded-full bg-indigo-50 text-indigo-600">
              <UserRound className="size-7" aria-hidden />
            </span>
          )}
          <div className="min-w-0">
            <h1 className="page-title truncate">{staff.name}</h1>
            {staff.title && <p className="text-sm text-slate-500">{staff.title}</p>}
            {!staff.is_active && <p className="text-xs text-amber-700">{t.common.inactive}</p>}
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">{d.servicesTitle}</h2>
        <p className="text-sm text-slate-500">{d.servicesHelp}</p>
        <div className="card">
          {services.length === 0 ? (
            <p className="text-sm text-slate-500">
              {d.noServices}{" "}
              <Link href={href("/dashboard/services")} className="font-semibold text-indigo-600 underline">{t.dashboard.services.title}</Link>
            </p>
          ) : (
            <FieldsForm
              action={saveStaffServices.bind(null, id)}
              fields={serviceFields}
              defaults={serviceDefaults}
              submitLabel={t.common.save}
            />
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">{d.hoursTitle}</h2>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-indigo-50/60 p-3 text-sm text-indigo-900">
          <span>{own.length ? d.hoursOwn : d.hoursShop}</span>
          {own.length > 0 && (
            <ActionButton action={followShopHours.bind(null, id)} confirmText={d.useShopQ} className="btn-ghost px-3 py-1.5">
              {d.useShop}
            </ActionButton>
          )}
        </div>
        {/* Prefilled with the shop's week until they have their own. */}
        <HoursForm hours={own.length ? own : shopHours} action={saveStaffHours.bind(null, id)} saveLabel={d.saveHours} />
        <p className="text-sm text-slate-500">
          {d.daysOffHint}{" "}
          <Link href={href("/dashboard/schedule")} className="font-semibold text-indigo-600 underline">{t.dashboard.schedule.title}</Link>
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">{d.loginTitle}</h2>
        <p className="text-sm text-slate-500">{d.loginHelp}</p>
        <div className="card">
          <StaffLogin staffId={id} staffName={staff.name} login={login} />
        </div>
      </section>
    </div>
  );
}
