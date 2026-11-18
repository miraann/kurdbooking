"use client";

// Bridge to the owner app's BackgroundReliabilityPlugin (native/mobile): it
// checks and fixes the battery settings that stop booking pushes from
// reaching a swiped-away app. Outside the app, or in an app built before the
// plugin (1.0), every helper returns null / does nothing. Ported from zhewar.

export interface BackgroundStatus {
  ignoringBatteryOptimizations: boolean;
  backgroundRestricted: boolean;
  manufacturer: string;
  aggressiveOem: boolean;
}

interface BackgroundReliabilityPlugin {
  getStatus(): Promise<BackgroundStatus>;
  requestIgnoreBatteryOptimizations(): Promise<BackgroundStatus>;
  openAutostartSettings(): Promise<void>;
  openAppSettings(): Promise<void>;
}

const PROMPTED_KEY = "kb_battery_prompted";

// Wrapped in an object: a Capacitor plugin proxy answers every property,
// `then` included, so resolving a promise with it directly would call a
// native `then` that doesn't exist.
let loaded: Promise<{ plugin: BackgroundReliabilityPlugin } | null> | null = null;

async function load() {
  loaded ??= import("@capacitor/core").then(({ Capacitor, registerPlugin }) =>
    Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("BackgroundReliability")
      ? { plugin: registerPlugin<BackgroundReliabilityPlugin>("BackgroundReliability") }
      : null,
  );
  return await loaded; // still the wrapper: the plugin itself must not be returned from an async function
}

export const isBackgroundReliable = (s: BackgroundStatus) => s.ignoringBatteryOptimizations && !s.backgroundRestricted;

/** null outside the app, or in an app without the plugin. */
export async function getBackgroundStatus(): Promise<BackgroundStatus | null> {
  const plugin = (await load())?.plugin;
  return plugin ? plugin.getStatus() : null;
}

export async function requestIgnoreBatteryOptimizations(): Promise<BackgroundStatus | null> {
  const plugin = (await load())?.plugin;
  return plugin ? plugin.requestIgnoreBatteryOptimizations() : null;
}

export async function openAutostartSettings(): Promise<void> {
  await (await load())?.plugin.openAutostartSettings();
}

export async function openAppSettings(): Promise<void> {
  await (await load())?.plugin.openAppSettings();
}

/** The system "run in the background?" dialog, once per install, right after push is on. */
export async function promptBatteryOnce(): Promise<void> {
  try {
    if (localStorage.getItem(PROMPTED_KEY)) return;
  } catch {
    return;
  }
  const status = await getBackgroundStatus();
  if (!status || status.ignoringBatteryOptimizations) return;
  try {
    localStorage.setItem(PROMPTED_KEY, "1");
  } catch {}
  await requestIgnoreBatteryOptimizations();
}
