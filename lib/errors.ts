import { FieldError } from "@/lib/fields.server";
import type { Lang } from "@/lib/i18n/config";
import { DICTS } from "@/lib/i18n/dictionaries";

/** Turns a thrown error into a short message for the user, in their language. */
export function userMessage(e: unknown, lang: Lang): string {
  if (e instanceof FieldError) return e.message; // already translated
  const t = DICTS[lang].errors;
  const code = (e as { code?: string } | null)?.code;
  switch (code) {
    case "23505":
      return t.duplicate;
    case "23503":
      return t.inUse;
    case "23514":
    case "22P02":
      return t.invalidData;
    case "23P01":
      return t.slotTaken;
    case "42501":
      return t.forbidden;
    case "P0001": {
      // Named errors raised by the database functions (0008).
      const msg = String((e as { message?: string }).message ?? "");
      if (msg.includes("already_replied")) return t.alreadyReplied;
      if (msg.includes("customer_blocked")) return t.customerBlocked;
      if (msg.includes("empty_reply")) return t.invalidData;
      break;
    }
  }
  console.error(e);
  return t.generic;
}
