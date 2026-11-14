import Link from "next/link";
import type { Metadata } from "next";
import {
  Banknote, CalendarDays, CalendarPlus, CheckCircle2, Clock, Home, RotateCcw, Scissors, UserRound, XCircle,
} from "lucide-react";
import { getPublicShop } from "@/lib/shop-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { mainSiteLink, shopBasePath } from "@/lib/tenant";
import { fill } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { APPOINTMENT_STATUS } from "@/lib/labels";
import type { AppointmentStatus } from "@/lib/types";
import { ShopStrip } from "@/components/shop/theme";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.receipt.metaTitle, robots: { index: false } };
}

const UUID = /^[0-9a-f-]{36}$/i;

// Status colours from zhewar's receipt: green done, amber waiting, red off.
const TONE: Record<AppointmentStatus, { box: string; text: string; ring: string }> = {
  pending: { box: "bg-amber-50 border-amber-100", text: "text-amber-600", ring: "border-amber-200 bg-amber-50" },
  confirmed: { box: "bg-emerald-50 border-emerald-100", text: "text-emerald-600", ring: "border-emerald-200 bg-emerald-50" },
  completed: { box: "bg-emerald-50 border-emerald-100", text: "text-emerald-600", ring: "border-emerald-200 bg-emerald-50" },
  cancelled: { box: "bg-red-50 border-red-100", text: "text-red-500", ring: "border-red-200 bg-red-50" },
  no_show: { box: "bg-red-50 border-red-100", text: "text-red-500", ring: "border-red-200 bg-red-50" },
};

/** Customer receipt (zhewar's ticket). Only opens with the secret token from the booking link. */
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
        <p className="card-shop text-neutral-600">{r.notFound}</p>
      </main>
    );
  }

  const a = data as unknown as {
    starts_at: string; status: AppointmentStatus; service_name: string | null; price_iqd: number | null;
    staff: { name: string } | null; customers: { full_name: string } | null;
  };
  const { date, time } = f.instant(a.starts_at, shop.timezone);
  const tone = TONE[a.status];
  const statusLabel = APPOINTMENT_STATUS[a.status][lang];
  const isOff = a.status === "cancelled" || a.status === "no_show";
  const isActive = a.status === "pending" || a.status === "confirmed";
  const name = a.customers?.full_name ?? "";
  const shortId = `#${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;

  return (
    <main className="mx-auto flex max-w-md flex-col items-center px-4 pt-10">
      {/* Status heading */}
      <div className="mb-7 flex flex-col items-center gap-3 text-center motion-safe:animate-fade-up">
        <div className="relative">
          <div className={`grid size-20 place-items-center rounded-full border-2 shadow-md ${tone.ring}`}>
            {isOff ? <XCircle className={`size-9 ${tone.text}`} aria-hidden /> :
              a.status === "pending" ? <Clock className={`size-9 ${tone.text}`} aria-hidden /> :
              <CheckCircle2 className={`size-9 ${tone.text}`} aria-hidden />}
          </div>
          {!isOff && (
            <div className={`absolute -inset-2 rounded-full border-2 opacity-40 motion-safe:animate-ping ${tone.ring}`} style={{ animationDuration: "2.5s" }} />
          )}
        </div>
        <h1 className="text-xl font-bold text-neutral-900">
          {a.status === "pending" ? r.pendingTitle : a.status === "confirmed" ? r.confirmedTitle : statusLabel}
        </h1>
        {a.status === "pending" && <p className="text-sm font-medium text-neutral-500">{fill(r.waitFor, { shop: shop.name })}</p>}
        {isOff && <p className="text-sm font-medium text-neutral-500">{r.cancelledHelp}</p>}
      </div>

      {/* Ticket */}
      <div className="relative w-full motion-safe:animate-fade-up">
        <div className="absolute -start-3 top-[42%] z-10 size-6 -translate-y-1/2 rounded-full border border-neutral-200/60 bg-neutral-100" />
        <div className="absolute -end-3 top-[42%] z-10 size-6 -translate-y-1/2 rounded-full border border-neutral-200/60 bg-neutral-100" />

        <div className="overflow-hidden rounded-3xl border border-neutral-100 bg-white shadow-xl">
          <ShopStrip kind={shop.kind} />

          {/* Customer */}
          <div className="flex flex-col items-center gap-1.5 px-6 pb-5 pt-6">
            <div
              className="grid size-20 place-items-center rounded-full font-display text-3xl font-bold shadow-md"
              style={{ color: "var(--shop-primary)", background: "color-mix(in srgb, var(--shop-primary) 8%, white)" }}
            >
              {name.slice(0, 1) || "—"}
            </div>
            <p className="mt-2 text-xl font-bold text-neutral-800">{name || "—"}</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="font-mono text-xs font-bold tracking-wider" style={{ color: "var(--shop-primary)" }} dir="ltr">{shortId}</span>
              <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${tone.box} ${tone.text}`}>{statusLabel}</span>
            </div>
          </div>

          <div className="mx-4 border-t-2 border-dashed border-neutral-200" />

          {/* Details */}
          <dl className="grid grid-cols-2 gap-3 p-4">
            <Tile icon={<CalendarDays className="size-[18px]" />} iconClass="bg-blue-500/10 text-blue-600" label={r.date} value={date} />
            <Tile icon={<Clock className="size-[18px]" />} iconClass="bg-emerald-500/10 text-emerald-600" label={r.time} value={time} />
            <Tile icon={<Scissors className="size-[18px]" />} iconClass="bg-amber-500/10 text-amber-600" label={r.service} value={a.service_name} />
            {a.staff?.name ? (
              <Tile icon={<UserRound className="size-[18px]" />} iconClass="bg-violet-500/10 text-violet-600" label={r.with} value={a.staff.name} />
            ) : (
              <Tile icon={<Home className="size-[18px]" />} iconClass="bg-violet-500/10 text-violet-600" label={r.shop} value={shop.name} />
            )}
            {a.price_iqd != null && (
              <Tile icon={<Banknote className="size-[18px]" />} iconClass="bg-red-500/10 text-red-500" label={r.price} value={f.iqd(a.price_iqd)} />
            )}
            <div className={`flex items-center gap-3 rounded-2xl border p-3 ${tone.box} ${a.price_iqd == null ? "col-span-2" : ""}`}>
              <div className={`shrink-0 rounded-xl bg-white/60 p-2 ${tone.text}`}><CheckCircle2 className="size-[18px]" aria-hidden /></div>
              <div className="min-w-0">
                <dt className={`text-[10px] font-medium opacity-70 ${tone.text}`}>{r.status}</dt>
                <dd className={`mt-0.5 text-sm font-bold leading-tight ${tone.text}`}>{statusLabel}</dd>
              </div>
            </div>
          </dl>

          <div className="mx-4 border-t-2 border-dashed border-neutral-200" />

          <div className="flex items-center justify-center gap-2 py-4">
            <Scissors className="size-3 text-neutral-500" aria-hidden />
            <p className="text-sm font-bold tracking-[0.2em] text-neutral-700">{shop.name}</p>
            <Scissors className="size-3 -scale-x-100 text-neutral-500" aria-hidden />
          </div>

          {isActive && (
            <div className="px-5 pb-5">
              <p
                className="rounded-2xl border px-4 py-2.5 text-center text-xs font-bold"
                style={{
                  color: "var(--shop-primary)",
                  background: "color-mix(in srgb, var(--shop-primary) 6%, white)",
                  borderColor: "color-mix(in srgb, var(--shop-primary) 15%, white)",
                }}
              >
                {r.beEarly}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Actions: zhewar's red "my bookings" + white "home" */}
      <div className="mt-4 w-full space-y-3 motion-safe:animate-fade-up">
        {isOff && (
          <Link href={href(`${base}/book`)} className="btn-shop w-full">
            <CalendarPlus className="size-5" aria-hidden /> {t.shop.bookNow}
          </Link>
        )}
        <Link href={mainSiteLink(base, href("/account"))} className="btn-shop-accent w-full">
          <RotateCcw className="size-4" aria-hidden /> {t.shop.checkBookings}
        </Link>
        <Link href={href(base || "/")} className="btn-ghost w-full border-2 py-3.5 text-base">
          <Home className="size-4" aria-hidden /> {r.home}
        </Link>
      </div>
    </main>
  );
}

function Tile({ icon, iconClass, label, value }: { icon: React.ReactNode; iconClass: string; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-neutral-100 bg-neutral-50 p-3">
      <div className={`shrink-0 rounded-xl p-2 ${iconClass}`} aria-hidden>{icon}</div>
      <div className="min-w-0">
        <dt className="text-[10px] font-medium text-neutral-400">{label}</dt>
        <dd className="mt-0.5 truncate text-sm font-bold leading-tight text-neutral-700">{value || "—"}</dd>
      </div>
    </div>
  );
}
