import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import type { Metadata } from "next";
import { CalendarDays, ChevronLeft, Clock, LogOut, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getViewer, type Customer } from "@/lib/customer";
import { displayPhone } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { tx } from "@/lib/i18n/config";
import { APPOINTMENT_STATUS } from "@/lib/labels";
import type { AppointmentStatus } from "@/lib/types";
import { Heading, LogoRing, RING } from "@/components/shop/theme";
import { CustomerAuth } from "./CustomerAuth";
import { CancelBooking } from "./CancelBooking";
import { customerLogout } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.account.metaTitle, robots: { index: false } };
}

// The customer's profile: create one / log in, then their bookings in every
// shop with the live status. Reads the session, so it streams inside
// loading.tsx's Suspense boundary.
export default async function AccountPage({ searchParams }: PageProps<"/[lang]/account">) {
  await connection(); // the session check compares token expiry with the current time: never prerender
  const [{ next: rawNext }, viewer, { t, href }] = await Promise.all([searchParams, getViewer(), getI18n()]);
  const a = t.account;
  const next = typeof rawNext === "string" && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : undefined;

  if (viewer.kind === "guest") {
    return (
      <main className="mx-auto max-w-md px-5 pt-12">
        <Heading as="h1" eyebrow="PROFILE" title={a.guestTitle}>
          <p className="mx-auto mt-4 max-w-sm text-balance text-[0.95rem] font-medium leading-relaxed text-neutral-500">{a.guestText}</p>
        </Heading>
        <div className="card-shop">
          <CustomerAuth next={next} />
        </div>
      </main>
    );
  }

  if (viewer.kind === "staff") {
    return (
      <main className="mx-auto max-w-md px-5 pt-12">
        <div className="card-shop space-y-4 text-center">
          <p className="text-neutral-600">{a.staffAccount}</p>
          <Link href={href("/dashboard")} className="btn-shop">{a.toDashboard}</Link>
          <form action={customerLogout}>
            <button type="submit" className="btn-shop-accent w-full">{a.logout}</button>
          </form>
        </div>
      </main>
    );
  }

  // Logged in now, but sent here on the way to something (e.g. booking).
  if (next && next !== "/account") redirect(href(next));

  return (
    <main className="mx-auto max-w-2xl px-5 pt-12">
      <Heading as="h1" eyebrow="PROFILE" title={a.title} />
      <ProfileCard customer={viewer.customer} />
      <MyBookings />
    </main>
  );
}

async function ProfileCard({ customer }: { customer: Customer }) {
  const { t } = await getI18n();
  const initial = customer.name.trim().charAt(0);
  return (
    <section className="card-shop flex items-center gap-4">
      <div className="size-14 shrink-0 rounded-full p-[2.5px]" style={{ background: RING }}>
        <div className="grid size-full place-items-center rounded-full bg-white text-xl font-bold" style={{ color: "var(--shop-primary)" }}>
          {initial || <UserRound className="size-6" aria-hidden />}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-bold text-neutral-900">{customer.name}</p>
        <p className="text-sm text-neutral-500"><span dir="ltr">{displayPhone(customer.phone)}</span></p>
      </div>
      <form action={customerLogout}>
        <button
          type="submit"
          className="flex min-h-10 touch-manipulation items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-600 transition active:scale-95"
        >
          <LogOut className="size-4 ltr:rotate-180" aria-hidden /> {t.account.logout}
        </button>
      </form>
    </section>
  );
}

interface MyAppointment {
  id: string;
  shop_slug: string;
  shop_name: string;
  shop_logo_url: string | null;
  staff_name: string | null;
  service_name: string | null;
  starts_at: string;
  status: AppointmentStatus;
  public_token: string;
  can_cancel: boolean;
}

// Every shop is in Sulaimani for now (one time zone).
const TIME_ZONE = "Asia/Baghdad";

const TONE: Record<AppointmentStatus, string> = {
  pending: "bg-amber-50 text-amber-700",
  confirmed: "bg-emerald-50 text-emerald-700",
  completed: "bg-neutral-100 text-neutral-600",
  cancelled: "bg-red-50 text-red-600",
  no_show: "bg-red-50 text-red-600",
};

async function MyBookings() {
  const supabase = await createClient();
  const [{ data }, { t, href }] = await Promise.all([supabase.rpc("my_appointments"), getI18n()]);
  const a = t.account;
  const rows = (data ?? []) as MyAppointment[];
  const upcoming = rows.filter((r) => r.can_cancel).reverse(); // soonest first
  const past = rows.filter((r) => !r.can_cancel);

  if (rows.length === 0) {
    return (
      <section className="mt-10">
        <h2 className="mb-4 text-lg font-bold text-neutral-900">{a.myBookings}</h2>
        <div className="card-shop space-y-4 py-8 text-center">
          <p className="text-sm text-neutral-500">{a.noBookings}</p>
          <Link href={href("/")} className="btn-shop">{a.findShop}</Link>
        </div>
      </section>
    );
  }

  return (
    <>
      {upcoming.length > 0 && <BookingList title={a.upcoming} rows={upcoming} />}
      {past.length > 0 && <BookingList title={a.history} rows={past} />}
    </>
  );
}

async function BookingList({ title, rows }: { title: string; rows: MyAppointment[] }) {
  const { lang, f, href } = await getI18n();
  return (
    <section className="mt-10">
      <h2 className="mb-4 text-lg font-bold text-neutral-900">{title}</h2>
      <ul className="space-y-3">
        {rows.map((r) => {
          const at = f.instant(r.starts_at, TIME_ZONE);
          return (
            <li key={r.id} className="rounded-3xl border border-neutral-100 bg-white p-4 shadow-sm">
              <Link href={href(`/s/${r.shop_slug}/appointment/${r.id}?t=${r.public_token}`)} className="flex items-center gap-3">
                <LogoRing logoUrl={r.shop_logo_url} className="size-12" iconClassName="size-5" spin={false} />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-bold text-neutral-900">{r.shop_name}</span>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[0.7rem] font-bold ${TONE[r.status]}`}>
                      {tx(APPOINTMENT_STATUS[r.status], lang)}
                    </span>
                  </div>
                  <p className="truncate text-sm text-neutral-600">
                    {r.service_name}{r.staff_name ? ` · ${r.staff_name}` : ""}
                  </p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
                    <span className="flex items-center gap-1.5"><CalendarDays className="size-3.5 text-neutral-400" aria-hidden />{at.date}</span>
                    <span className="flex items-center gap-1.5"><Clock className="size-3.5 text-neutral-400" aria-hidden />{at.time}</span>
                  </div>
                </div>
                <ChevronLeft className="size-4 shrink-0 text-neutral-300 ltr:rotate-180" aria-hidden />
              </Link>
              {r.can_cancel && (
                <div className="mt-3 flex justify-end border-t border-neutral-100 pt-3">
                  <CancelBooking id={r.id} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
