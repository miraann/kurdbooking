"use client";

import Link from "next/link";
import { CalendarDays, ChevronLeft, Clock } from "lucide-react";
import { useSyncExternalStore } from "react";
import { bookingsKey, type SavedBooking } from "@/lib/saved-bookings";
import { useI18n } from "@/components/i18n/I18nProvider";

// Bookings made on this device are remembered in localStorage (no customer
// login). Each links to its receipt, which shows the live status.

const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};

export function MyBookings({ slug, base }: { slug: string; base: string }) {
  const { t, href } = useI18n();
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(bookingsKey(slug)) ?? "[]";
      } catch {
        return "[]";
      }
    },
    () => null, // server render: unknown until the browser reads storage
  );

  if (raw === null) return <div className="h-24 animate-pulse rounded-3xl bg-neutral-100" />;
  let items: SavedBooking[] = [];
  try {
    items = JSON.parse(raw);
  } catch {}

  if (items.length === 0) {
    return (
      <div className="card-shop space-y-4 py-8 text-center">
        <p className="text-sm text-neutral-500">{t.myBookings.none}</p>
        <Link href={href(`${base}/book`)} className="btn-shop">{t.shop.bookNow}</Link>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((b) => {
        // Saved as "date · time" by the booking form.
        const [date, time] = b.when.split(" · ");
        return (
          <li key={b.id}>
            <Link
              href={href(`${base}/appointment/${b.id}?t=${b.token}`)}
              className="flex touch-manipulation items-center gap-3 rounded-2xl border border-neutral-100 bg-white p-4 shadow-sm transition-colors active:bg-neutral-50"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-bold text-neutral-900">{b.service}</span>
                  <span className="shrink-0 font-mono text-[0.65rem] font-semibold" style={{ color: "var(--shop-primary)" }} dir="ltr">
                    #{b.id.replace(/-/g, "").slice(0, 8).toUpperCase()}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
                  <span className="flex items-center gap-1.5"><CalendarDays className="size-3.5 text-neutral-400" aria-hidden />{date}</span>
                  {time && <span className="flex items-center gap-1.5"><Clock className="size-3.5 text-neutral-400" aria-hidden />{time}</span>}
                </div>
              </div>
              <ChevronLeft className="size-4 shrink-0 text-neutral-300 ltr:rotate-180" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
