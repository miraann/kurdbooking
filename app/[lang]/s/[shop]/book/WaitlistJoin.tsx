"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { BellRing, Check, Loader2 } from "lucide-react";
import type { Viewer } from "@/lib/customer";
import { useI18n } from "@/components/i18n/I18nProvider";
import { joinWaitlist } from "./actions";

/**
 * Under "no free times": join that day's waitlist. Customers join in one tap;
 * guests make a profile first and come back to this day. Shop accounts don't
 * see it.
 */
export function WaitlistJoin({
  slug, viewer, serviceId, staffId, date, profileHref,
}: {
  slug: string;
  viewer: Viewer;
  serviceId: string;
  staffId: string;
  date: string;
  profileHref: string;
}) {
  const { t, href } = useI18n();
  const b = t.booking;
  const [joined, setJoined] = useState<string | null>(null); // the date joined
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  if (viewer.kind === "staff") return null;
  if (viewer.kind === "guest") {
    return (
      <div className="space-y-2">
        <p className="px-6 text-sm text-neutral-500">{b.waitlistGuest}</p>
        <Link href={profileHref} className="btn-shop-accent w-auto px-5 py-3 text-sm">{t.account.guestTitle}</Link>
      </div>
    );
  }
  if (joined === date) {
    return (
      <div className="mx-4 space-y-2 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">
        <p className="flex items-center justify-center gap-2 font-bold"><Check className="size-4" aria-hidden /> {b.waitlistJoined}</p>
        <p>{b.waitlistHow}</p>
        <Link href={href("/account")} className="font-semibold underline">{b.waitlistAlerts}</Link>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError("");
          start(async () => {
            const result = await joinWaitlist(slug, { serviceId, staffId, date });
            if (result.ok) setJoined(date);
            else setError(result.message ?? t.errors.generic);
          });
        }}
        className="btn-shop w-auto px-5 py-3 text-sm disabled:opacity-60"
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <BellRing className="size-4" aria-hidden />} {b.waitlistJoin}
      </button>
      {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
    </div>
  );
}
