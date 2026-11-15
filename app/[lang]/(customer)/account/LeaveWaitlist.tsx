"use client";

import { useState, useTransition } from "react";
import { Loader2, X } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { leaveWaitlist } from "./actions";

export function LeaveWaitlist({ id }: { id: string }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError("");
          start(async () => {
            const result = await leaveWaitlist(id);
            if (!result.ok) setError(result.message ?? t.errors.generic);
          });
        }}
        className="flex min-h-10 touch-manipulation items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-600 transition active:scale-95 disabled:opacity-60"
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <X className="size-4" aria-hidden />}
        {t.account.waitlistLeave}
      </button>
      {error && <span role="alert" className="text-xs font-semibold text-red-600">{error}</span>}
    </span>
  );
}
