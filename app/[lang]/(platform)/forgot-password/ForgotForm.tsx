"use client";

import { useActionState } from "react";
import { MailCheck } from "lucide-react";
import { initialActionState } from "@/lib/fields";
import { useI18n } from "@/components/i18n/I18nProvider";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { requestPasswordReset } from "../auth-actions";

/** Email → reset link. `linkError` = came back from an expired or used link. */
export function ForgotForm({ linkError = false }: { linkError?: boolean }) {
  const { t } = useI18n();
  const [state, action] = useActionState(requestPasswordReset, initialActionState);
  const showLinkError = linkError && !state.nonce;

  return (
    <form action={action} key={state.nonce ?? 0} className="card space-y-4">
      {showLinkError && <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">{t.password.linkInvalid}</p>}
      {state.ok && state.message && (
        <p role="status" className="flex items-start gap-2 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-800">
          <MailCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          {state.message}
        </p>
      )}
      <div>
        <label htmlFor="email" className="label">{t.login.email}</label>
        <input id="email" name="email" type="email" dir="ltr" defaultValue={state.values?.email} required autoComplete="email" className="input" />
      </div>
      {!state.ok && state.message && <p className="text-sm text-rose-700">{state.message}</p>}
      <SubmitButton className="btn-primary w-full py-3">{t.password.send}</SubmitButton>
    </form>
  );
}
