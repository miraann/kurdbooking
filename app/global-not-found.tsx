import "./globals.css";
import type { Metadata } from "next";
import { DICTS } from "@/lib/i18n/dictionaries";
import { dirOf, LOCALES, localePath } from "@/lib/i18n/config";

// 404 for URLs that match no route at all. It renders outside app/[lang], so
// the language is unknown: the message is shown in all three languages.
// (A notFound() inside a page uses app/[lang]/not-found.tsx, in one language.)

export const metadata: Metadata = { title: "404 | KurdBooking" };

export default function GlobalNotFound() {
  return (
    <html lang="ckb" dir="rtl" className="h-full antialiased">
      <body className="grid min-h-dvh place-items-center bg-surface px-6 text-center">
        <main>
          <p className="text-6xl font-bold text-brand">404</p>
          <ul className="mt-4 space-y-2">
            {LOCALES.map((lang) => (
              <li key={lang} lang={lang} dir={dirOf(lang)} className="text-slate-600">
                {DICTS[lang].notFound.text}{" "}
                <a href={localePath(lang, "/")} className="font-semibold text-brand underline">{DICTS[lang].common.back}</a>
              </li>
            ))}
          </ul>
        </main>
      </body>
    </html>
  );
}
