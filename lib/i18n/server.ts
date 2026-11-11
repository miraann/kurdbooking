import { lang as rootLang } from "next/root-params";
import { DEFAULT_LANG, isLang, type Lang } from "@/lib/i18n/config";
import { i18nFor } from "@/lib/i18n/server-shared";

// For Server Components (pages, layouts, generateMetadata). The language comes
// from the URL's [lang] segment, so it is static: pages stay prerendered.
// Server Actions and Route Handlers can't read root params: use
// lib/i18n/request.ts there.

export { i18nFor, type I18n } from "@/lib/i18n/server-shared";

export async function getLang(): Promise<Lang> {
  const l = await rootLang();
  return isLang(l) ? l : DEFAULT_LANG;
}

/** Everything a Server Component needs: t (texts), f (numbers/dates), href (links). */
export async function getI18n() {
  return i18nFor(await getLang());
}
