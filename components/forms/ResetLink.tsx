"use client";

import { useState, useTransition } from "react";
import { fill, whatsappLink } from "@/lib/format";
import { useI18n } from "@/components/i18n/I18nProvider";

type Result = { ok: boolean; message?: string; link?: string };

/**
 * Makes a one-time password-reset link (a bound Server Action), then sends it
 * on WhatsApp or copies it. `message` is the WhatsApp text with a {link}
 * placeholder. Without a phone, WhatsApp opens to pick the chat.
 * Used for shop owners (/super) and staff logins (dashboard).
 */
export function ResetLink({ make, phone, message, label }: { make: () => Promise<Result>; phone?: string | null; message: string; label: string }) {
  const { t } = useI18n();
  const ts = t.super.shop;
  const [pending, start] = useTransition();
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);
  const link = result?.link;
  const text = link ? fill(message, { link }) : "";

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={pending}
        className="btn-tonal"
        onClick={() =>
          start(async () => {
            setCopied(false);
            setResult(await make());
          })
        }
      >
        {pending ? t.common.pleaseWait : ts.resetMake}
      </button>
      {result && !result.ok && <p className="text-sm text-rose-700">{result.message}</p>}
      {link && (
        <div className="space-y-2">
          <input readOnly value={link} dir="ltr" aria-label={label} className="input text-xs" onFocus={(e) => e.currentTarget.select()} />
          <div className="flex flex-wrap gap-2">
            <a
              href={phone ? whatsappLink(phone, text) : `https://wa.me/?text=${encodeURIComponent(text)}`}
              target="_blank"
              rel="noreferrer"
              className="btn-primary"
            >
              {ts.resetSend}
            </a>
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
