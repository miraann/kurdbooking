"use client";

// Native push in the Capacitor app (native/mobile). The app shows the live
// site, and Capacitor injects its bridge into it, so the plugin works from
// here. In a normal browser every function returns early.
//
// Android channel "alerts" must match ANDROID_CHANNEL in lib/push.ts.

import { saveNativePushToken } from "@/app/[lang]/push-actions";

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

/** Listeners once per app start: save the token, open tapped alerts, show alerts that arrive while the app is open. */
export async function listenNativePush(onForeground: (a: ForegroundAlert) => void): Promise<void> {
  if (!hasNativePush() || listening) return;
  listening = true;
  const push = await plugin();

  await push.addListener("registration", ({ value }) => {
    saveNativePushToken(value, platform()).catch(() => {});
  });
  await push.addListener("registrationError", (err) => console.error("push registration", err));
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
    await push.createChannel({
      id: "alerts",
      name: "KurdBooking",
      description: "New bookings and orders",
      importance: 5,
      visibility: 1,
      vibration: true,
    });
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
