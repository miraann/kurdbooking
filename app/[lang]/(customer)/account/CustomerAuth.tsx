"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { initialActionState } from "@/lib/fields";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { ActionState } from "@/lib/fields";
import { customerLogin, customerResetPassword, customerSignup } from "./actions";

type Mode = "signup" | "login" | "reset";

/**
 * Create a profile (name, phone, password) or log in with phone + password.
 * Used on /account and inside the booking page's last step. Without `next`
 * the page it is on re-renders logged in (the session cookie changed).
 *
 * With WhatsApp set up, signup asks for a code sent to the phone, and
 * `canReset` shows «forgot password» (also a WhatsApp code).
 */
export function CustomerAuth({ next, startWith = "signup", canReset = false }: { next?: string; startWith?: Mode; canReset?: boolean }) {
  const { t } = useI18n();
  const a = t.account;
  const [mode, setMode] = useState<Mode>(startWith);
  if (mode === "reset") {
    return (
      <div className="space-y-4">
        <div className="space-y-1 text-center">
          <h2 className="text-lg font-extrabold text-neutral-900">{a.resetTitle}</h2>
          <p className="text-sm font-medium text-neutral-500">{a.resetText}</p>
        </div>
        <ResetForm next={next} />
        <button type="button" onClick={() => setMode("login")} className="w-full touch-manipulation text-sm font-bold text-neutral-500 underline-offset-4 hover:underline">
          {a.backToLogin}
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div role="tablist" className="grid grid-cols-2 gap-1 rounded-2xl bg-neutral-100 p-1">
        {(["signup", "login"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`touch-manipulation rounded-xl py-2.5 text-sm font-bold transition ${
              mode === m ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500"
            }`}
          >
            {m === "signup" ? a.signupTab : a.loginTab}
          </button>
        ))}
      </div>
      {mode === "signup" ? <SignupForm next={next} /> : <LoginForm next={next} />}
      {mode === "login" && canReset && (
        <button type="button" onClick={() => setMode("reset")} className="w-full touch-manipulation text-sm font-bold text-neutral-500 underline-offset-4 hover:underline">
          {a.forgot}
        </button>
      )}
    </div>
  );
}

/** Keeps the password in the browser between the two steps (the server never sends it back). */
type Step = (prev: ActionState, fd: FormData) => Promise<ActionState>;
const keepPassword =
  (run: Step): Step =>
  async (prev, fd) => {
    const r = await run(prev, fd);
    return { ...r, values: { ...r.values, password: String(fd.get("password") ?? "") } };
  };

function SignupForm({ next }: { next?: string }) {
  const { t } = useI18n();
  const a = t.account;
  const [state, action] = useActionState(keepPassword(customerSignup), initialActionState);
  if (state.step === "code") {
    return (
      <form action={action} key={state.nonce ?? 0} className="space-y-3">
        {next && <input type="hidden" name="next" value={next} />}
        <input type="hidden" name="full_name" value={state.values?.full_name ?? ""} />
        <input type="hidden" name="phone" value={state.values?.phone ?? ""} />
        <input type="hidden" name="password" value={state.values?.password ?? ""} />
        <CodeFields phone={state.values?.phone} />
        {state.message && <ErrorBox message={state.message} />}
        <Submit>{a.verify}</Submit>
        <ResendButton />
      </form>
    );
  }
  return (
    <form action={action} key={state.nonce ?? 0} className="space-y-3">
      {next && <input type="hidden" name="next" value={next} />}
      <Field label={a.name}>
        <input name="full_name" required minLength={2} maxLength={80} defaultValue={state.values?.full_name} autoComplete="name" className="input-shop" />
      </Field>
      <Field label={a.phone}>
        <input name="phone" type="tel" inputMode="tel" dir="ltr" required defaultValue={state.values?.phone} placeholder="07XX XXX XXXX" autoComplete="tel" className="input-shop" />
      </Field>
      <Field label={a.password} help={a.passwordHelp}>
        <input name="password" type="password" dir="ltr" required minLength={6} maxLength={72} autoComplete="new-password" className="input-shop" />
      </Field>
      {state.message && <ErrorBox message={state.message} />}
      <Submit>{a.signup}</Submit>
    </form>
  );
}

/** Forgot password: phone, then the WhatsApp code and a new password. */
function ResetForm({ next }: { next?: string }) {
  const { t } = useI18n();
  const a = t.account;
  const [state, action] = useActionState(customerResetPassword, initialActionState);
  if (state.step === "code") {
    return (
      <form action={action} key={state.nonce ?? 0} className="space-y-3">
        {next && <input type="hidden" name="next" value={next} />}
        <input type="hidden" name="phone" value={state.values?.phone ?? ""} />
        <CodeFields phone={state.values?.phone} />
        <Field label={a.newPassword} help={a.passwordHelp}>
          <input name="password" type="password" dir="ltr" required minLength={6} maxLength={72} autoComplete="new-password" className="input-shop" />
        </Field>
        {state.message && <ErrorBox message={state.message} />}
        <Submit>{a.resetButton}</Submit>
        <ResendButton />
      </form>
    );
  }
  return (
    <form action={action} key={state.nonce ?? 0} className="space-y-3">
      {next && <input type="hidden" name="next" value={next} />}
      <Field label={a.phone}>
        <input name="phone" type="tel" inputMode="tel" dir="ltr" required defaultValue={state.values?.phone} placeholder="07XX XXX XXXX" autoComplete="tel" className="input-shop" />
      </Field>
      {state.message && <ErrorBox message={state.message} />}
      <Submit>{a.sendCode}</Submit>
    </form>
  );
}

/** «We sent a code to this number», and the box for it. */
function CodeFields({ phone }: { phone?: string }) {
  const { t } = useI18n();
  const a = t.account;
  return (
    <>
      <p className="text-sm font-medium leading-relaxed text-neutral-600">
        {a.codeText}
        {phone && (
          <>
            {" "}
            <span dir="ltr" className="inline-block font-bold text-neutral-900">{phone}</span>
          </>
        )}
      </p>
      <Field label={a.code}>
        <input
          name="code"
          inputMode="numeric"
          dir="ltr"
          required
          autoFocus
          maxLength={12}
          autoComplete="one-time-code"
          placeholder="------"
          className="input-shop text-center text-xl font-bold tracking-[0.4em]"
        />
      </Field>
    </>
  );
}

/** Submits the form without a code: the server answers with a new one. */
function ResendButton() {
  const { t } = useI18n();
  const { pending } = useFormStatus();
  return (
    <button type="submit" name="resend" value="1" formNoValidate disabled={pending} className="w-full touch-manipulation text-sm font-bold text-neutral-500 underline-offset-4 hover:underline disabled:opacity-50">
      {t.account.resend}
    </button>
  );
}

function LoginForm({ next }: { next?: string }) {
  const { t } = useI18n();
  const a = t.account;
  const [state, action] = useActionState(customerLogin, initialActionState);
  return (
    <form action={action} key={state.nonce ?? 0} className="space-y-3">
      {next && <input type="hidden" name="next" value={next} />}
      <Field label={a.phone}>
        <input name="phone" type="tel" inputMode="tel" dir="ltr" required defaultValue={state.values?.phone} placeholder="07XX XXX XXXX" autoComplete="tel" className="input-shop" />
      </Field>
      <Field label={a.password}>
        <input name="password" type="password" dir="ltr" required autoComplete="current-password" className="input-shop" />
      </Field>
      {state.message && <ErrorBox message={state.message} />}
      <Submit>{a.login}</Submit>
    </form>
  );
}

function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-semibold text-neutral-700">{label}</span>
      {children}
      {help && <span className="block text-xs text-neutral-400">{help}</span>}
    </label>
  );
}

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-shop w-full">
      {pending && <Loader2 className="size-5 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {message}
    </p>
  );
}
