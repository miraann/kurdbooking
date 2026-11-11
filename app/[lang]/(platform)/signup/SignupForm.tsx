"use client";

import { useActionState } from "react";
import { CircleCheck } from "lucide-react";
import { initialActionState } from "@/lib/fields";
import { displayPhone } from "@/lib/format";
import { SHOP_KIND } from "@/lib/labels";
import { useI18n } from "@/components/i18n/I18nProvider";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { requestShop } from "../auth-actions";

/** The order form: it sends a request to us. Only the super admin creates shops. */
export function SignupForm() {
  const { lang, t } = useI18n();
  const s = t.signup;
  const [state, action] = useActionState(requestShop, initialActionState);
  const v = state.values ?? {};

  if (state.ok) {
    return (
      <div className="card space-y-3 text-center">
        <CircleCheck className="mx-auto size-12 text-emerald-500" aria-hidden />
        <h2 className="text-xl font-bold text-slate-900">{s.sentTitle}</h2>
        <p className="text-slate-600">
          {s.sentText} <span dir="ltr" className="font-semibold">{displayPhone(v.phone ?? "")}</span>
        </p>
      </div>
    );
  }

  return (
    <form action={action} key={state.nonce ?? 0} className="card space-y-4">
      <fieldset className="space-y-4">
        <legend className="mb-3 text-sm font-bold text-indigo-600">{s.shopSection}</legend>
        <div>
          <label htmlFor="shop_name" className="label">{s.shopName} *</label>
          <input id="shop_name" name="shop_name" defaultValue={v.shop_name} required maxLength={80} className="input" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="kind" className="label">{s.kind} *</label>
            <select id="kind" name="kind" defaultValue={v.kind || "barber"} className="input">
              {Object.entries(SHOP_KIND).map(([k, label]) => (
                <option key={k} value={k}>{label[lang]}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="city" className="label">{s.city}</label>
            <input id="city" name="city" defaultValue={v.city} maxLength={60} className="input" />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t border-slate-100 pt-4">
        <legend className="mb-3 text-sm font-bold text-indigo-600">{s.ownerSection}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="owner_name" className="label">{s.ownerName} *</label>
            <input id="owner_name" name="owner_name" defaultValue={v.owner_name} required maxLength={80} className="input" />
          </div>
          <div>
            <label htmlFor="phone" className="label">{s.phone} *</label>
            <input id="phone" name="phone" type="tel" dir="ltr" defaultValue={v.phone} required maxLength={20} placeholder="07XX XXX XXXX" className="input" />
          </div>
        </div>
        <div>
          <label htmlFor="note" className="label">{s.note}</label>
          <textarea id="note" name="note" defaultValue={v.note} maxLength={500} rows={3} className="input" />
          <p className="help">{s.noteHelp}</p>
        </div>
      </fieldset>

      {/* Honeypot: hidden from people, bots fill it in. */}
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

      {state.message && <p className="text-sm text-rose-700">{state.message}</p>}
      <SubmitButton className="btn-primary w-full py-3 text-base">{s.submit}</SubmitButton>
    </form>
  );
}
