"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Bell, BellOff } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { pollNewBookings } from "@/app/[lang]/dashboard/desktop-actions";

// The Windows app (native/windows) puts this marker in its user agent (tauri.conf.json).
const MARKER = "KurdBookingDesktop";
const EVERY_MS = 30_000;

export const isDesktopApp = () => typeof navigator !== "undefined" && navigator.userAgent.includes(MARKER);
// false on the server and while hydrating
const useDesktop = () => useSyncExternalStore(() => () => {}, isDesktopApp, () => false);

function show(title: string, body: string, url: string) {
  const n = new Notification(title, { body, icon: "/favicon.ico" });
  n.onclick = () => {
    window.focus();
    if (url) window.location.assign(url);
    n.close();
  };
}

/**
 * Mounted in the dashboard layout. In the Windows app only: asks the server every 30 s for
 * new bookings and shows each as a Windows notification (WebView2 has no Web Push). Keep
 * the window open (minimized is fine). Nothing happens in a browser or the phone apps.
 */
export function DesktopAlerts() {
  const desktop = useDesktop();

  useEffect(() => {
    if (!desktop || !("Notification" in window)) return;
    if (Notification.permission === "default") Notification.requestPermission().catch(() => {});
    let since: string | null = null;
    let stopped = false;
    const tick = async () => {
      try {
        const r = await pollNewBookings(since);
        if (stopped) return;
        since = r.now;
        if (Notification.permission === "granted") r.alerts.forEach((a) => show(a.title, a.body, a.url));
      } catch {
        // offline or logged out: try again next time, with the same window
      }
    };
    tick();
    const timer = setInterval(tick, EVERY_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [desktop]);

  return null;
}

/** Dashboard → Settings, Windows app only (takes the place of the browser-push card). */
export function DesktopCard() {
  const { t } = useI18n();
  const d = t.push.desktop;
  const desktop = useDesktop();
  const [, rerender] = useState(0);

  if (!desktop) return null;
  // Only reached on the client after hydration (desktop is false before), so no mismatch.
  const permission: NotificationPermission | null = "Notification" in window ? Notification.permission : null;
  const on = permission === "granted";
  return (
    <section className="card flex flex-wrap items-center gap-4">
      <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${on ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
        {on ? <Bell className="size-5" aria-hidden /> : <BellOff className="size-5" aria-hidden />}
      </span>
      <div className="min-w-48 flex-1">
        <h2 className="font-bold">{d.title}</h2>
        <p className="text-sm text-slate-600">{permission === null ? d.unsupported : on ? d.on : permission === "denied" ? d.denied : d.off}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {permission === "default" && (
          <button type="button" className="btn-primary" onClick={() => Notification.requestPermission().then(() => rerender((n) => n + 1))}>{d.turnOn}</button>
        )}
        {on && (
          <button type="button" className="btn-tonal" onClick={() => new Notification(t.push.testTitle, { body: t.push.testBody, icon: "/favicon.ico" })}>{t.push.test}</button>
        )}
      </div>
    </section>
  );
}
