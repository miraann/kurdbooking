"use client";

import { useEffect } from "react";
import { announceUnread } from "@/components/customer/unread";
import { markNotificationsRead } from "./actions";

/**
 * Opening the page counts as reading it: a moment later the notifications are
 * marked read and the red number on the tab goes away. The list on screen keeps
 * its «new» marks until the next visit.
 */
export function MarkSeen({ hasUnread }: { hasUnread: boolean }) {
  useEffect(() => {
    if (!hasUnread) return;
    const timer = setTimeout(() => {
      markNotificationsRead()
        .then((ok) => {
          if (ok) announceUnread(0);
        })
        .catch(() => {}); // offline: they stay unread and are marked at the next visit
    }, 900);
    return () => clearTimeout(timer);
  }, [hasUnread]);
  return null;
}
