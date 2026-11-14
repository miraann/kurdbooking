"use client";

import { useState, useTransition } from "react";
import { fill, whatsappLink } from "@/lib/format";
import { useI18n } from "@/components/i18n/I18nProvider";
import { makeResetLink } from "@/app/[lang]/super/actions";

/** Makes a one-time password-reset link for the owner, then WhatsApp or copy. */
export function ResetLink({ shopId, phone, ownerName }: { shopId: string; phone?: string | null; ownerName: string }) {
  const { t } = useI18n();
  const ts = t.super.shop;
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message?: string; link?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const link = result?.link;

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={pending}
        className="btn-tonal"
        onClick={() =>
          start(async () => {
            setCopied(false);
            setResult(await makeResetLink(shopId));
          })
        }
      >
        {pending ? t.common.pleaseWait : ts.resetMake}
      </button>
      {result && !result.ok && <p className="text-sm text-rose-700">{result.message}</p>}
      {link && (
        <div className="space-y-2">
          <input readOnly value={link} dir="ltr" aria-label={ts.resetTitle} className="input text-xs" onFocus={(e) => e.currentTarget.select()} />
          <div className="flex flex-wrap gap-2">
            {phone && (
              <a
                href={whatsappLink(phone, fill(ts.resetMessage, { name: ownerName, link }))}
                target="_blank"
                rel="noreferrer"
                className="btn-primary"
              >
                {ts.resetSend}
              </a>
            )}
            <button
              type="button"
              className="btn-ghost"
              onClick={() => navigator.clipboard.writeText(link).then(() => setCopied(true), () => {})}
            >
              {copied ? t.common.copied : t.common.copyLink}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
