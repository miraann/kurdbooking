"use client";

import { useFormStatus } from "react-dom";
import { useI18n } from "@/components/i18n/I18nProvider";

export function SubmitButton({
  children,
  className = "btn-primary",
  pendingText,
}: {
  children: React.ReactNode;
  className?: string;
  pendingText?: string;
}) {
  const { pending } = useFormStatus();
  const { t } = useI18n();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingText ?? t.common.pleaseWait : children}
    </button>
  );
}
