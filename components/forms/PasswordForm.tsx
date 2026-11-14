"use client";

import { useActionState } from "react";
import { initialActionState } from "@/lib/fields";
import { useI18n } from "@/components/i18n/I18nProvider";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { changePassword, resetPassword } from "@/app/[lang]/(platform)/auth-actions";

/**
 * New password + repeat. `reset` = from a reset link (/reset-password, no
 * current password); `change` = logged in (Settings), asks for the current one.
 */
export function PasswordForm({
  mode,
  email,
  className = "card space-y-4",
}: {
  mode: "reset" | "change";
  email?: string;
  className?: string;
}) {
  const { t } = useI18n();
  const p = t.password;
  const [state, action] = useActionState(mode === "reset" ? resetPassword : changePassword, initialActionState);

  return (
    // Remounts after every submit, so typed passwords never stay on screen.
    <form action={action} key={state.nonce ?? 0} className={className}>
      {/* Lets password managers save the new password under the right account. */}
      {email && <input type="email" name="username" value={email} autoComplete="username" readOnly hidden />}
      {mode === "change" && (
        <div>
          <label htmlFor="current" className="label">{p.current}</label>
          <input id="current" name="current" type="password" dir="ltr" required autoComplete="current-password" className="input" />
        </div>
      )}
      <div>
        <label htmlFor="password" className="label">{p.new}</label>
        <input id="password" name="password" type="password" dir="ltr" required minLength={8} maxLength={72} autoComplete="new-password" className="input" />
      </div>
      <div>
        <label htmlFor="confirm" className="label">{p.confirm}</label>
        <input id="confirm" name="confirm" type="password" dir="ltr" required minLength={8} maxLength={72} autoComplete="new-password" className="input" />
      </div>
      {state.message && (
        <p role="status" className={`text-sm ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>{state.message}</p>
      )}
      <SubmitButton className={`btn-primary py-3 ${mode === "reset" ? "w-full" : ""}`}>{p.save}</SubmitButton>
    </form>
  );
}
