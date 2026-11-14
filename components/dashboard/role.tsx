"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { MemberRole } from "@/lib/types";

// The logged-in member's role, for the dashboard nav. The nav is static (it
// renders outside the Suspense boundary that knows the user), so ShopGate
// mounts <RoleSync> and the nav reads it with useRole(). Unknown (null) until
// then: the nav shows every link, as for an owner.

let current: MemberRole | null = null;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function useRole(): MemberRole | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}

export function RoleSync({ role }: { role: MemberRole }) {
  useEffect(() => {
    current = role;
    listeners.forEach((l) => l());
  }, [role]);
  return null;
}
