// Languages of the app. Plain module: safe in server and client code, and in proxy.ts.
//
// Kurdish Sorani is the default and has no URL prefix:
//   /dashboard        → Kurdish
//   /ar/dashboard     → Arabic
//   /en/dashboard     → English
// proxy.ts rewrites unprefixed URLs to /ckb/… internally, so every page lives
// under app/[lang]/.

export const LOCALES = ["ckb", "ar", "en"] as const;
export type Lang = (typeof LOCALES)[number];
export const DEFAULT_LANG: Lang = "ckb";

/** Remembers the visitor's choice (set by <LanguageSwitcher>, read by proxy.ts). */
export const LANG_COOKIE = "kb_lang";
/** Set by proxy.ts on every request, so Server Actions know the language. */
export const LANG_HEADER = "x-kb-lang";

/** Each language's own name, for the picker. */
export const LANG_NAMES: Record<Lang, string> = { ckb: "کوردی", ar: "العربية", en: "English" };

export const isLang = (v: unknown): v is Lang => typeof v === "string" && (LOCALES as readonly string[]).includes(v);

export const dirOf = (lang: Lang): "rtl" | "ltr" => (lang === "en" ? "ltr" : "rtl");

/** A piece of text in every language (used by config lists: fields, labels, links). */
export type T3 = Record<Lang, string>;

/** Text that is either the same in every language (a URL, "Latitude") or translated. */
export type Txt = string | T3;

export const tx = (value: Txt, lang: Lang): string => (typeof value === "string" ? value : value[lang]);

/** "/dashboard" → "/ar/dashboard". Kurdish has no prefix. Leaves full URLs alone. */
export function localePath(lang: Lang, path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  if (lang === DEFAULT_LANG) return path;
  return path === "/" ? `/${lang}` : `/${lang}${path}`;
}

/**
 * Splits a visible pathname into its language and the rest.
 * "/ar/dashboard" → { lang: "ar", path: "/dashboard", prefix: "ar" }
 * "/dashboard"    → { lang: "ckb", path: "/dashboard", prefix: null }
 */
export function splitLocale(pathname: string): { lang: Lang; path: string; prefix: Lang | null } {
  const first = pathname.split("/")[1] ?? "";
  if (isLang(first)) {
    const rest = pathname.slice(first.length + 1);
    return { lang: first, path: rest === "" ? "/" : rest, prefix: first };
  }
  return { lang: DEFAULT_LANG, path: pathname || "/", prefix: null };
}
