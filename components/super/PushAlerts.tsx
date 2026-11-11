"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, BellOff } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { removePushSubscription, savePushSubscription, sendTestPush } from "@/app/[lang]/super/actions";

type Status = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

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

/** Turn push alerts on/off for this browser (new /signup orders). */
export function PushAlerts({ publicKey }: { publicKey: string }) {
  const { t } = useI18n();
  const p = t.push;
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    let cancelled = false;
    const set = (s: Status) => !cancelled && setStatus(s);
    (async () => {
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

  const turnOn = () =>
    start(async () => {
      setMessage("");
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
      const res = await sendTestPush();
      setMessage(res.message ?? "");
    });

  const note =
    status === "unsupported" ? p.unsupported
    : status === "ios-install" ? p.iosInstall
    : status === "denied" ? p.denied
    : status === "on" ? p.onHelp
    : status === "off" ? p.offHelp
    : "";

  return (
    <section className="card flex flex-wrap items-center gap-4">
      <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${status === "on" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
        {status === "on" ? <Bell className="size-5" aria-hidden /> : <BellOff className="size-5" aria-hidden />}
      </span>
      <div className="min-w-48 flex-1">
        <h2 className="font-bold">{p.title}</h2>
        <p className="text-sm text-slate-600">{note || "…"}</p>
        {message && <p className="mt-1 text-sm font-semibold text-indigo-700">{message}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {status === "off" && (
          <button type="button" className="btn-primary" disabled={pending} onClick={turnOn}>{pending ? "…" : p.turnOn}</button>
        )}
        {status === "on" && (
          <>
            <button type="button" className="btn-tonal" disabled={pending} onClick={test}>{pending ? "…" : p.test}</button>
            <button type="button" className="btn-ghost" disabled={pending} onClick={turnOff}>{p.turnOff}</button>
          </>
        )}
      </div>
    </section>
  );
}
