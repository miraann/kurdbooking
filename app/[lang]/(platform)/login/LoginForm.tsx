"use client";

import { useActionState } from "react";
import { initialActionState } from "@/lib/fields";
import { useI18n } from "@/components/i18n/I18nProvider";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { login, superLogin } from "../auth-actions";

/** `admin` = the super admin login (/super/login); otherwise the shop login. */
export function LoginForm({ next, admin = false }: { next?: string; admin?: boolean }) {
  const { t } = useI18n();
  const [state, action] = useActionState(admin ? superLogin : login, initialActionState);
  return (
    <form action={action} key={state.nonce ?? 0} className="card space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <div>
        <label htmlFor="email" className="label">{t.login.email}</label>
        <input id="email" name="email" type="email" dir="ltr" defaultValue={state.values?.email} required autoComplete="email" className="input" />
      </div>
      <div>
        <label htmlFor="password" className="label">{t.login.password}</label>
        <input id="password" name="password" type="password" dir="ltr" required autoComplete="current-password" className="input" />
      </div>
      {state.message && <p className="text-sm text-rose-700">{state.message}</p>}
      <SubmitButton className="btn-primary w-full py-3">{t.login.title}</SubmitButton>
    </form>
  );
}
