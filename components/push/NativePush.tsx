"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { enableNativePush, listenNativePush, type ForegroundAlert } from "./native";

/**
 * Mounted in the dashboard and /super layouts. Inside the Android app it
 * turns on push by itself (asks for permission the first time) and shows
 * alerts that arrive while the app is open. In a browser it renders nothing.
 */
export function NativePush() {
  const { t } = useI18n();
  const [alert, setAlert] = useState<ForegroundAlert | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    listenNativePush((a) => {
      setAlert(a);
      clearTimeout(timer);
      timer = setTimeout(() => setAlert(null), 8000);
    })
      .then(() => enableNativePush())
      .catch((e) => console.error("native push", e));
    return () => clearTimeout(timer);
  }, []);

  if (!alert) return null;
  return (
    <div className="fixed inset-x-3 top-[calc(0.75rem+env(safe-area-inset-top,0px))] z-50 mx-auto max-w-md">
      <div className="card-emphasized flex items-start gap-3 p-4 shadow-lg">
        <Bell className="mt-0.5 size-5 shrink-0 text-indigo-600" aria-hidden />
        <button
          type="button"
          className="min-w-0 flex-1 text-start"
          onClick={() => {
            setAlert(null);
            if (alert.url) window.location.assign(alert.url);
          }}
        >
          <span className="block font-bold text-slate-900">{alert.title}</span>
          <span className="block text-sm text-slate-600">{alert.body}</span>
        </button>
        <button type="button" className="text-slate-400" aria-label={t.common.close} onClick={() => setAlert(null)}>
          <X className="size-5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
