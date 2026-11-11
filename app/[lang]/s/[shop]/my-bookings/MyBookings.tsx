"use client";

import Link from "next/link";
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

  if (raw === null) return <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />;
  let items: SavedBooking[] = [];
  try {
    items = JSON.parse(raw);
  } catch {}

  if (items.length === 0) {
    return (
      <div className="card space-y-3 text-center">
        <p className="text-slate-600">{t.myBookings.none}</p>
        <Link href={href(`${base}/book`)} className="btn-shop">{t.shop.bookNow}</Link>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((b) => (
        <li key={b.id}>
          <Link href={href(`${base}/appointment/${b.id}?t=${b.token}`)} className="card block hover:shadow-md">
            <p className="font-semibold">{b.service}</p>
            <p className="text-sm text-slate-500">{b.when}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
