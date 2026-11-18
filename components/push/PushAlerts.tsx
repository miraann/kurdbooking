"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, BellOff } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { removePushSubscription, savePushSubscription, sendTestPush } from "@/app/[lang]/push-actions";
import { isDesktopApp } from "./DesktopAlerts";
import { enableNativePush, hasNativePush, isNativeApp, nativeProblem, nativeStatus } from "./native";

type Status = "loading" | "unsupported" | "no-app-push" | "ios-install" | "denied" | "off" | "on";

function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const b64 = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration() {
  return navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
}

/** dashboard = indigo admin look; customer = the red/blue customer pages, with customer texts. */
type Tone = "dashboard" | "customer";
const LOOK: Record<Tone, { card: string; primary: string; secondary: string; ghost: string; on: string; off: string; message: string }> = {
  dashboard: {
    card: "card", primary: "btn-primary", secondary: "btn-tonal", ghost: "btn-ghost",
    on: "bg-emerald-50 text-emerald-600", off: "bg-slate-100 text-slate-500", message: "text-indigo-700",
  },
  customer: {
    card: "card-shop", primary: "btn-shop w-auto px-5 py-3 text-sm", secondary: "btn-shop-accent w-auto px-5 py-3 text-sm",
    ghost: "rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-600",
    on: "bg-emerald-50 text-emerald-600", off: "bg-neutral-100 text-neutral-500", message: "text-neutral-900",
  },
};

/**
 * Notifications on/off for this device. In the Android app it uses native
 * push (FCM); in a browser, Web Push. The server decides which alerts each
 * person gets (lib/push.ts). Hidden inside an app built without push.
 */
export function PushAlerts({ publicKey, tone = "dashboard" }: { publicKey: string; tone?: Tone }) {
  const { t } = useI18n();
  const p = t.push;
  const look = LOOK[tone];
  const [status, setStatus] = useState<Status>("loading");
  const [native, setNative] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    let cancelled = false;
    const set = (s: Status) => !cancelled && setStatus(s);
    (async () => {
      // The Windows app has no Web Push: DesktopAlerts shows its own card and polls instead.
      if (isDesktopApp()) return set("no-app-push");
      if (isNativeApp() && !hasNativePush()) return set("no-app-push");
      if (isNativeApp()) {
        if (!cancelled) setNative(true);
        try {
          const s = await Promise.race([
            nativeStatus(),
            new Promise<never>((_, no) => setTimeout(() => no(new Error("no answer from the app (10 s)")), 10000)),
          ]);
          return set(s === "granted" ? "on" : s === "denied" ? "denied" : "off");
        } catch (e) {
          if (!cancelled) setMessage(e instanceof Error ? e.message : String(e));
          return set("off");
        }
      }
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return set(ios && !standalone ? "ios-install" : "unsupported");
      }
      if (Notification.permission === "denied") return set("denied");
      try {
        const sub = await (await registration()).pushManager.getSubscription();
        if (sub) {
          // Keep the server copy fresh (language, login).
          await savePushSubscription(sub.toJSON(), navigator.userAgent);
          set("on");
        } else set("off");
      } catch {
        set("unsupported");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Problems from the native push set-up (token not saved, channel failed…).
  useEffect(() => {
    const show = () => setMessage(nativeProblem);
    if (nativeProblem) show();
    window.addEventListener("kb-native-push-problem", show);
    return () => window.removeEventListener("kb-native-push-problem", show);
  }, []);

  const turnOn = () =>
    start(async () => {
      setMessage("");
      if (native) {
        try {
          const s = await enableNativePush();
          setStatus(s === "granted" ? "on" : "denied");
        } catch (e) {
          setMessage(e instanceof Error ? e.message : String(e));
        }
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      try {
        const reg = await registration();
        await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
        const res = await savePushSubscription(sub.toJSON(), navigator.userAgent);
        if (!res.ok) {
          await sub.unsubscribe();
          setMessage(res.message ?? p.failed);
          return;
        }
        setStatus("on");
      } catch {
        setMessage(p.failed);
      }
    });

  const turnOff = () =>
    start(async () => {
      setMessage("");
      const sub = await (await registration()).pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus("off");
    });

  const test = () =>
    start(async () => {
      const res = await sendTestPush(tone === "customer" ? "/account" : "/dashboard");
      setMessage(res.message ?? "");
    });

  const note =
    status === "unsupported" ? p.unsupported
    : status === "ios-install" ? p.iosInstall
    : status === "denied" ? (native ? p.deniedApp : p.denied)
    : status === "on" ? (tone === "customer" ? p.customerOnHelp : p.onHelp)
    : status === "off" ? (tone === "customer" ? p.customerOffHelp : p.offHelp)
    : "";

  if (status === "no-app-push") return null;

  return (
    <section className={`${look.card} flex flex-wrap items-center gap-4`}>
      <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${status === "on" ? look.on : look.off}`}>
        {status === "on" ? <Bell className="size-5" aria-hidden /> : <BellOff className="size-5" aria-hidden />}
      </span>
      <div className="min-w-48 flex-1">
        <h2 className="font-bold">{p.title}</h2>
        <p className="text-sm text-slate-600">{note || "…"}</p>
        {message && <p className={`mt-1 text-sm font-semibold ${look.message}`}>{message}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {status === "off" && (
          <button type="button" className={look.primary} disabled={pending} onClick={turnOn}>{pending ? "…" : p.turnOn}</button>
        )}
        {status === "on" && (
          <>
            <button type="button" className={look.secondary} disabled={pending} onClick={test}>{pending ? "…" : p.test}</button>
            {/* In the app, notifications are switched off in the phone's settings. */}
            {!native && <button type="button" className={look.ghost} disabled={pending} onClick={turnOff}>{p.turnOff}</button>}
          </>
        )}
      </div>
    </section>
  );
}
