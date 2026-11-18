"use client";

import { useSyncExternalStore } from "react";

// The number on the notifications tab. One value for the whole page, shared by
// the phone tab bar and the desktop header links. The tab bar keeps it fresh
// (CustomerTabBar): it asks /api/customer/unread when the tab changes, when the
// app comes back to the front, and once a minute. Opening the notifications
// page sets it to 0 straight away (announceUnread).

let unread = 0;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

export function announceUnread(n: number) {
  if (n === unread) return;
  unread = n;
  listeners.forEach((l) => l());
}

/** Unread notifications of the logged-in customer (0 for everyone else). */
export const useUnread = () => useSyncExternalStore(subscribe, () => unread, () => 0);

/** Asks the server. A failure keeps the number we have. */
export async function refreshUnread() {
  try {
    const res = await fetch("/api/customer/unread", { cache: "no-store", credentials: "same-origin" });
    if (!res.ok) return;
    const data: unknown = await res.json();
    const n = (data as { unread?: unknown })?.unread;
    if (typeof n === "number" && n >= 0) announceUnread(n);
  } catch {
    // offline: keep what we know
  }
}
