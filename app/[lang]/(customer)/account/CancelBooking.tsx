"use client";

import { useState, useTransition } from "react";
import { Loader2, X } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { cancelMyBooking } from "./actions";

export function CancelBooking({ id }: { id: string }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(t.account.confirmCancel)) return;
          setError("");
          start(async () => {
            const result = await cancelMyBooking(id);
            if (!result.ok) setError(result.message ?? t.errors.generic);
          });
        }}
        className="flex min-h-10 touch-manipulation items-center gap-1.5 rounded-full border border-red-100 bg-red-50 px-4 text-sm font-bold text-red-600 transition active:scale-95 disabled:opacity-60"
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <X className="size-4" aria-hidden />}
        {t.account.cancel}
      </button>
      {error && <p role="alert" className="text-xs font-semibold text-red-600">{error}</p>}
    </div>
  );
}
