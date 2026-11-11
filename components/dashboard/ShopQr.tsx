"use client";

import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";

/** QR code + copy button for the shop's public link (print it for the counter). */
export function ShopQr({ url }: { url: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-4">
      <div className="rounded-xl bg-white p-2 ring-1 ring-slate-200">
        <QRCodeSVG value={url} size={112} fgColor="#4f46e5" />
      </div>
      <div className="min-w-0 space-y-2">
        <p className="text-sm text-slate-600">{t.dashboard.home.qrHelp}</p>
        <button
          type="button"
          className="btn-ghost px-3 py-1.5 text-xs"
          onClick={async () => {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? t.common.copied : t.common.copyLink}
        </button>
      </div>
    </div>
  );
}
