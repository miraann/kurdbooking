import { localePath, type Lang } from "@/lib/i18n/config";
import { DICTS } from "@/lib/i18n/dictionaries";
import { fmt } from "@/lib/format";

/** t (texts), f (numbers/dates), href (links) for one language. */
export function i18nFor(lang: Lang) {
  return {
    lang,
    t: DICTS[lang],
    f: fmt(lang),
    href: (path: string) => localePath(lang, path),
  };
}

export type I18n = ReturnType<typeof i18nFor>;
