import "server-only";
import { headers } from "next/headers";
import { DEFAULT_LANG, isLang, LANG_HEADER, type Lang } from "@/lib/i18n/config";
import { i18nFor } from "@/lib/i18n/server-shared";

// For Server Actions, Route Handlers and the auth helpers: proxy.ts puts the
// page's language in a request header. Reading headers makes a render
// dynamic, so pages use lib/i18n/server.ts instead.

export async function getRequestLang(): Promise<Lang> {
  const value = (await headers()).get(LANG_HEADER);
  return isLang(value) ? value : DEFAULT_LANG;
}

export async function getActionI18n() {
  return i18nFor(await getRequestLang());
}
