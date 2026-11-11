"use client";

import { useActionState, useRef, useState } from "react";
import { initialActionState } from "@/lib/fields";
import { SHOP_KIND } from "@/lib/labels";
import { useI18n } from "@/components/i18n/I18nProvider";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { createShop } from "@/app/[lang]/super/actions";

const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "";
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/^https?:\/\//, "");

/** Easy to read out over the phone: no 0/O or 1/l/I. */
function randomPassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export function NewShopForm({ initial, requestId }: { initial: Record<string, string>; requestId?: string }) {
  const { lang, t } = useI18n();
  const s = t.signup;
  const n = t.super.newShop;
  const [state, action] = useActionState(createShop, initialActionState);
  const v = state.values ?? initial;
  const [slug, setSlug] = useState(v.slug ?? "");
  const password = useRef<HTMLInputElement>(null);
  const preview = slug || "nawi-dukan";

  return (
    <form action={action} key={state.nonce ?? 0} className="card space-y-4">
      {requestId && <input type="hidden" name="request_id" value={requestId} />}
      <fieldset className="space-y-4">
        <legend className="mb-3 text-sm font-bold text-indigo-600">{s.shopSection}</legend>
        <div>
          <label htmlFor="shop_name" className="label">{s.shopName} *</label>
          <input id="shop_name" name="shop_name" defaultValue={v.shop_name} required maxLength={80} className="input" />
        </div>
        <div>
          <label htmlFor="slug" className="label">{n.slug} *</label>
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
          <p className="help">{n.slugHelp}</p>
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
            <label htmlFor="owner_name" className="label">{n.ownerName} *</label>
            <input id="owner_name" name="owner_name" defaultValue={v.owner_name} required maxLength={80} className="input" />
          </div>
          <div>
            <label htmlFor="phone" className="label">{s.phone} *</label>
            <input id="phone" name="phone" type="tel" dir="ltr" defaultValue={v.phone} required placeholder="07XX XXX XXXX" className="input" />
          </div>
          <div>
            <label htmlFor="email" className="label">{t.login.email} *</label>
            <input id="email" name="email" type="email" dir="ltr" defaultValue={v.email} required className="input" autoComplete="off" />
          </div>
          <div>
            <label htmlFor="password" className="label">{t.login.password} *</label>
            <div className="flex gap-2">
              <input
                ref={password}
                id="password"
                name="password"
                type="text"
                dir="ltr"
                defaultValue={v.password}
                required
                minLength={8}
                maxLength={72}
                className="input"
                autoComplete="off"
              />
              <button
                type="button"
                className="btn-tonal shrink-0"
                onClick={() => {
                  if (password.current) password.current.value = randomPassword();
                }}
              >
                {n.generate}
              </button>
            </div>
            <p className="help">{n.passwordHelp}</p>
          </div>
        </div>
      </fieldset>

      {state.message && <p className="text-sm text-rose-700">{state.message}</p>}
      <SubmitButton className="btn-primary w-full py-3 text-base">{n.submit}</SubmitButton>
    </form>
  );
}
