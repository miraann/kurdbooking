"use client";

import { useEffect, useState } from "react";
import { BatteryCharging } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { isNativeApp } from "./native";
import {
  getBackgroundStatus, isBackgroundReliable, openAppSettings, openAutostartSettings, requestIgnoreBatteryOptimizations,
  type BackgroundStatus,
} from "./background";

// "outdated" = an app built before the plugin (owner app 1.0).
type Status = BackgroundStatus | "outdated";

/**
 * Dashboard → Settings, inside the Android app only: can booking alerts reach
 * the phone when the app is swiped away? If not, buttons to the screens that
 * fix it (battery dialog, app info, the vendor's autostart list).
 */
export function BackgroundCard() {
  const { t } = useI18n();
  const b = t.push.background;
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isNativeApp()) return;
    const refresh = () =>
      getBackgroundStatus()
        .then((s) => setStatus(s ?? "outdated"))
        .catch(() => setStatus("outdated"));
    refresh();
    // Check again when the person comes back from the phone's settings.
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  if (!status) return null;
  const outdated = status === "outdated";
  const ok = !outdated && isBackgroundReliable(status);
  const vendor = outdated ? "" : status.manufacturer;
  const hint =
    vendor === "samsung" ? b.hintSamsung
    : ["xiaomi", "redmi", "poco"].includes(vendor) ? b.hintXiaomi
    : ["huawei", "honor"].includes(vendor) ? b.hintHuawei
    : b.hintOther;

  return (
    <section className="card space-y-4">
      <div className="flex items-center gap-4">
        <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${ok ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
          <BatteryCharging className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold">{b.title}</h2>
          <p className="text-sm text-slate-600">{outdated ? b.outdated : ok ? b.ok : b.limited}</p>
        </div>
      </div>

      {!outdated && !status.ignoringBatteryOptimizations && (
        <button
          type="button"
          className="btn-primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const next = await requestIgnoreBatteryOptimizations();
              if (next) setStatus(next);
            } catch {
              // No dialog on this phone: the buttons below still work.
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "…" : b.allow}
        </button>
      )}

      {!outdated && status.backgroundRestricted && (
        <div className="space-y-2">
          <p className="text-sm text-rose-700">{b.restricted}</p>
          <button type="button" className="btn-ghost" onClick={() => openAppSettings().catch(() => {})}>{b.appInfo}</button>
        </div>
      )}

      {!outdated && status.aggressiveOem && (
        <div className="space-y-2">
          <p className="text-sm text-slate-600">{hint}</p>
          <button type="button" className="btn-ghost" onClick={() => openAutostartSettings().catch(() => {})}>{b.openVendor}</button>
        </div>
      )}
    </section>
  );
}
