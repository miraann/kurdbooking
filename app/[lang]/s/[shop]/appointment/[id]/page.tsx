import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { getPublicShop } from "@/lib/shop-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { shopBasePath } from "@/lib/tenant";
import { fill } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { APPOINTMENT_STATUS } from "@/lib/labels";
import type { AppointmentStatus } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.receipt.metaTitle, robots: { index: false } };
}

const UUID = /^[0-9a-f-]{36}$/i;

/** Customer receipt. Only opens with the secret token from the booking link. */
export default async function ReceiptPage({ params, searchParams }: PageProps<"/[lang]/s/[shop]/appointment/[id]">) {
  const [{ shop: slug, id }, { t: tokenParam }] = await Promise.all([params, searchParams]);
  const shop = await getPublicShop(slug);
  if (!shop) return null;
  const [base, { lang, t, f, href }] = await Promise.all([shopBasePath(slug), getI18n()]);
  const r = t.receipt;
  const token = typeof tokenParam === "string" ? tokenParam : "";

  const { data } = UUID.test(id) && UUID.test(token)
    ? await createAdminClient()
        .from("appointments")
        .select("starts_at, status, service_name, price_iqd, staff(name), customers(full_name)")
        .eq("id", id)
        .eq("shop_id", shop.id)
        .eq("public_token", token)
        .maybeSingle()
    : { data: null };

  if (!data) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="card text-slate-600">{r.notFound}</p>
      </main>
    );
  }

  const a = data as unknown as {
    starts_at: string; status: AppointmentStatus; service_name: string | null; price_iqd: number | null;
    staff: { name: string } | null; customers: { full_name: string } | null;
  };
  const { date, time } = f.instant(a.starts_at, shop.timezone);
  const icon =
    a.status === "confirmed" || a.status === "completed" ? <CheckCircle2 className="size-14 text-emerald-600" /> :
    a.status === "pending" ? <Clock className="size-14 text-amber-500" /> :
    <XCircle className="size-14 text-rose-500" />;

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <div className="card space-y-5 text-center">
        <div className="flex justify-center">{icon}</div>
        <div>
          <h1 className="text-xl font-bold">
            {a.status === "pending" ? r.pendingTitle : a.status === "confirmed" ? r.confirmedTitle : APPOINTMENT_STATUS[a.status][lang]}
          </h1>
          {a.status === "pending" && <p className="mt-1 text-sm text-slate-500">{fill(r.waitFor, { shop: shop.name })}</p>}
        </div>
        <dl className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-start text-sm">
          <Item label={r.name} value={a.customers?.full_name} />
          <Item label={r.service} value={a.service_name} />
          <Item label={r.date} value={date} />
          <Item label={r.time} value={time} />
          {a.staff?.name && <Item label={r.with} value={a.staff.name} />}
          {a.price_iqd != null && <Item label={r.price} value={f.iqd(a.price_iqd)} />}
          <Item label={r.status} value={APPOINTMENT_STATUS[a.status][lang]} />
        </dl>
        {(a.status === "pending" || a.status === "confirmed") && (
          <p className="text-sm font-semibold" style={{ color: "var(--shop-primary)" }}>{r.beEarly}</p>
        )}
        <div className="flex justify-center gap-2">
          <Link href={href(`${base}/my-bookings`)} className="btn-ghost">{t.shop.myBookings}</Link>
          <Link href={href(base || "/")} className="btn-shop">{t.common.back}</Link>
        </div>
      </div>
    </main>
  );
}

function Item({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-semibold">{value || "—"}</dd>
    </div>
  );
}
