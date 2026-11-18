"use client";

// Native push in the Capacitor app (native/mobile). The app shows the live
// site, and Capacitor injects its bridge into it, so the plugin works from
// here. In a normal browser every function returns early.
//
// Android channels must match soundChannelId() in lib/notification-sounds.ts (used by lib/push.ts).

import { saveNativePushToken } from "@/app/[lang]/push-actions";
import { NOTIFICATION_SOUNDS, soundChannelId, soundResource } from "@/lib/notification-sounds";

export type NativeStatus = "unsupported" | "granted" | "denied" | "prompt";
export interface ForegroundAlert { title: string; body: string; url: string }

type CapacitorGlobal = { isNativePlatform?: () => boolean; getPlatform?: () => string; isPluginAvailable?: (name: string) => boolean };
const cap = (): CapacitorGlobal | undefined =>
  typeof window === "undefined" ? undefined : (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;

export const isNativeApp = () => !!cap()?.isNativePlatform?.();
/** The app was built with the push plugin (the owner app is; the customer app not yet). */
export const hasNativePush = () => isNativeApp() && !!cap()?.isPluginAvailable?.("PushNotifications");
const platform = () => (cap()?.getPlatform?.() === "ios" ? "ios" : "android");
const plugin = async () => (await import("@capacitor/push-notifications")).PushNotifications;

let listening = false;

/** The last native-push problem, shown on the alerts card (a silent failure looked like "…" forever). */
export let nativeProblem = "";
export const report = (where: string, e: unknown) => {
  const text = e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e);
  nativeProblem = `${where}: ${text}`;
  console.error("native push", nativeProblem);
  if (typeof window !== "undefined") window.dispatchEvent(new Event("kb-native-push-problem"));
};

/** Listeners once per app start: save the token, open tapped alerts, show alerts that arrive while the app is open. */
export async function listenNativePush(onForeground: (a: ForegroundAlert) => void): Promise<void> {
  if (!hasNativePush() || listening) return;
  listening = true;
  const push = await plugin();

  await push.addListener("registration", ({ value }) => {
    saveNativePushToken(value, platform())
      .then((r) => { if (!r.ok) report("save token", r.message ?? "refused"); })
      .catch((e) => report("save token", e));
  });
  await push.addListener("registrationError", (err) => report("registration", err.error));
  // Tapped in the tray (also when the tap started the app).
  await push.addListener("pushNotificationActionPerformed", ({ notification }) => {
    const url = (notification.data as { url?: string } | undefined)?.url;
    if (url?.startsWith("/")) window.location.assign(url);
  });
  // Android doesn't show alerts itself while the app is open: we do.
  await push.addListener("pushNotificationReceived", (n) => {
    const url = (n.data as { url?: string } | undefined)?.url ?? "";
    onForeground({ title: n.title ?? "", body: n.body ?? "", url: url.startsWith("/") ? url : "" });
  });

  if (platform() === "android") {
    // One channel per sound: Android fixes a channel's sound when it is created. A channel
    // keeps its settings, so creating them on every start is safe. (Apps built before 1.3 don't
    // have the sound files and play the phone's sound.)
    for (const s of NOTIFICATION_SOUNDS) {
      const res = soundResource(s.id);
      await push.createChannel({
        id: soundChannelId(s.id),
        name: s.id === "default" ? "KurdBooking" : `KurdBooking · ${s.label.en}`,
        description: "New bookings and orders",
        importance: 5,
        visibility: 1,
        vibration: true,
        ...(res ? { sound: `${res}.wav` } : {}),
        // One channel failing must not stop the others, or the registration after them.
      }).catch((e) => report(`channel ${s.id}`, e));
    }
  }
}

export async function nativeStatus(): Promise<NativeStatus> {
  if (!hasNativePush()) return "unsupported";
  const { receive } = await (await plugin()).checkPermissions();
  return receive === "granted" ? "granted" : receive === "denied" ? "denied" : "prompt";
}

/** Asks for permission (if not asked yet) and registers; the token is saved by the listener. */
export async function enableNativePush(): Promise<NativeStatus> {
  if (!hasNativePush()) return "unsupported";
  const push = await plugin();
  let { receive } = await push.checkPermissions();
  if (receive === "prompt" || receive === "prompt-with-rationale") receive = (await push.requestPermissions()).receive;
  if (receive !== "granted") return "denied";
  await push.register();
  return "granted";
}
