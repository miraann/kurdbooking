"use client";

import { createContext, useContext, useMemo } from "react";
import { localePath, type Lang } from "@/lib/i18n/config";
import type { Dict } from "@/lib/i18n/dictionaries";
import { fmt } from "@/lib/format";

// The root layout passes the page language and its dictionary (only that one
// language is sent to the browser). Client components call useI18n().

const I18nContext = createContext<{ lang: Lang; dict: Dict } | null>(null);

export function I18nProvider({ lang, dict, children }: { lang: Lang; dict: Dict; children: React.ReactNode }) {
  const value = useMemo(() => ({ lang, dict }), [lang, dict]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Same shape as getI18n() on the server: t, f, href, lang. */
export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n() needs <I18nProvider> (app/[lang]/layout.tsx)");
  const { lang, dict } = ctx;
  return useMemo(
    () => ({ lang, t: dict, f: fmt(lang), href: (path: string) => localePath(lang, path) }),
    [lang, dict],
  );
}
