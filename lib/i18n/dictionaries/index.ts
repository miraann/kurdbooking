import type { Lang } from "@/lib/i18n/config";
import ckb, { type Dict } from "./ckb";
import ar from "./ar";
import en from "./en";

export type { Dict };

/** Server-side only in practice: client components get their language's dictionary from <I18nProvider>. */
export const DICTS: Record<Lang, Dict> = { ckb, ar, en };
