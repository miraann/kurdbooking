"use client";

import { useActionState, useState } from "react";
import { initialActionState } from "@/lib/fields";
import { SHOP_KIND } from "@/lib/labels";
import { useI18n } from "@/components/i18n/I18nProvider";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { signup } from "../auth-actions";

const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "";
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/^https?:\/\//, "");

export function SignupForm() {
  const { lang, t } = useI18n();
  const s = t.signup;
  const [state, action] = useActionState(signup, initialActionState);
  const v = state.values ?? {};
  const [slug, setSlug] = useState(v.slug ?? "");
  const preview = slug || "nawi-dukan";

  return (
    <form action={action} key={state.nonce ?? 0} className="card space-y-4">
      <fieldset className="space-y-4">
        <legend className="mb-3 text-sm font-bold text-indigo-600">{s.shopSection}</legend>
        <div>
          <label htmlFor="shop_name" className="label">{s.shopName} *</label>
          <input id="shop_name" name="shop_name" defaultValue={v.shop_name} required maxLength={80} className="input" />
        </div>
        <div>
          <label htmlFor="slug" className="label">{s.slug} *</label>
          <input
            id="slug"
            name="slug"
            dir="ltr"
            defaultValue={v.slug}
            required
            pattern="[a-z0-9][a-z0-9\-]{1,30}[a-z0-9]"
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            placeholder="ali-barber"
            className="input"
          />
          <p className="help" dir="ltr">{ROOT ? `${preview}.${ROOT}` : `${SITE}/s/${preview}`}</p>
          <p className="help">{s.slugHelp}</p>
        </div>
        <div>
          <label htmlFor="kind" className="label">{s.kind} *</label>
          <select id="kind" name="kind" defaultValue={v.kind || "barber"} className="input">
            {Object.entries(SHOP_KIND).map(([k, label]) => (
              <option key={k} value={k}>{label[lang]}</option>
            ))}
          </select>
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t border-slate-100 pt-4">
        <legend className="mb-3 text-sm font-bold text-indigo-600">{s.ownerSection}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="owner_name" className="label">{s.ownerName} *</label>
            <input id="owner_name" name="owner_name" defaultValue={v.owner_name} required className="input" />
          </div>
          <div>
            <label htmlFor="phone" className="label">{s.phone} *</label>
            <input id="phone" name="phone" type="tel" dir="ltr" defaultValue={v.phone} required placeholder="07XX XXX XXXX" className="input" />
          </div>
          <div>
            <label htmlFor="email" className="label">{t.login.email} *</label>
            <input id="email" name="email" type="email" dir="ltr" defaultValue={v.email} required className="input" autoComplete="email" />
          </div>
          <div>
            <label htmlFor="password" className="label">{t.login.password} *</label>
            <input id="password" name="password" type="password" dir="ltr" required minLength={8} className="input" autoComplete="new-password" />
          </div>
        </div>
      </fieldset>

      {/* Honeypot: hidden from people, bots fill it in. */}
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

      {state.message && <p className="text-sm text-rose-700">{state.message}</p>}
      <SubmitButton className="btn-primary w-full py-3 text-base">{s.submit}</SubmitButton>
    </form>
  );
}
