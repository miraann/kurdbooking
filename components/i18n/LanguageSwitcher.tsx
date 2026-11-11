"use client";

import { Languages } from "lucide-react";
import { LANG_COOKIE, LANG_NAMES, LOCALES, localePath, splitLocale, type Lang } from "@/lib/i18n/config";
import { useI18n } from "@/components/i18n/I18nProvider";

/**
 * Language picker. Remembers the choice in a cookie (proxy.ts then opens
 * unprefixed links in that language) and reloads the same page in the new
 * language. A full load, because <html lang dir> changes.
 */
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { lang, t } = useI18n();

  function choose(next: Lang) {
    if (next === lang) return;
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    const { path } = splitLocale(window.location.pathname);
    window.location.assign(localePath(next, path) + window.location.search);
  }

  return (
    <label className={`relative inline-flex items-center ${className}`}>
      <span className="sr-only">{t.common.language}</span>
      <Languages className="pointer-events-none absolute start-2.5 size-4 text-slate-400" aria-hidden />
      <select
        value={lang}
        onChange={(e) => choose(e.target.value as Lang)}
        className="h-10 cursor-pointer appearance-none rounded-xl bg-transparent pe-3 ps-8 text-sm font-medium text-slate-500 hover:bg-slate-100/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l} lang={l}>
            {LANG_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
