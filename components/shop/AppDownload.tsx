"use client";

import { useSyncExternalStore } from "react";
import { Smartphone } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";

/** The customer Android app (native/customer), served from public/. */
export const CUSTOMER_APK = "/kurdbooking.apk";

type CapacitorGlobal = { isNativePlatform?: () => boolean };
const subscribe = () => () => {};

// Shown in browsers only: not inside the app itself, and not on iPhones/iPads (no APKs there).
function showLink(): boolean {
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  if (cap?.isNativePlatform?.()) return false;
  return !/iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function AppDownload({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  // Server render: hidden until the browser can tell where it runs.
  const show = useSyncExternalStore(subscribe, showLink, () => false);
  if (!show) return null;
  return (
    <a
      href={CUSTOMER_APK}
      download="KurdBooking.apk"
      className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-4 text-xs font-bold text-neutral-600 shadow-sm transition active:scale-95 ${className}`}
    >
      <Smartphone className="size-4" style={{ color: "var(--shop-primary)" }} aria-hidden />
      {t.shops.androidApp}
    </a>
  );
}
