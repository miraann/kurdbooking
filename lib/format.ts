// Formatting helpers. Pure functions: safe in server and client components.
// Anything shown to people goes through fmt(lang), so digits, times, dates
// and units follow the page's language:
//   ckb / ar → Arabic-Indic digits (١٠:٣٠), en → Latin digits (10:30).

import type { Lang } from "@/lib/i18n/config";

const EASTERN_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

/** "10:30" → "١٠:٣٠" in Kurdish and Arabic; unchanged in English. */
export function digits(value: string | number, lang: Lang): string {
  const s = String(value);
  return lang === "en" ? s : s.replace(/[0-9]/g, (d) => EASTERN_DIGITS[Number(d)]);
}

const DAY_NAMES: Record<Lang, string[]> = {
  ckb: ["یەکشەممە", "دووشەممە", "سێشەممە", "چوارشەممە", "پێنجشەممە", "هەینی", "شەممە"],
  ar: ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
};

// Iraq uses the Syriac month names in Arabic, like Kurdish does.
const MONTHS: Record<Lang, string[]> = {
  ckb: ["کانوونی دووەم", "شوبات", "ئازار", "نیسان", "ئایار", "حوزەیران", "تەمموز", "ئاب", "ئەیلوول", "تشرینی یەکەم", "تشرینی دووەم", "کانوونی یەکەم"],
  ar: ["كانون الثاني", "شباط", "آذار", "نيسان", "أيار", "حزيران", "تموز", "آب", "أيلول", "تشرين الأول", "تشرين الثاني", "كانون الأول"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};

const AM_PM: Record<Lang, [string, string]> = {
  ckb: ["پێش نیوەڕۆ", "دوا نیوەڕۆ"],
  ar: ["صباحاً", "مساءً"],
  en: ["AM", "PM"],
};

/** Counted units. Arabic takes the plural for 3–10 (٣ أيام) and the singular otherwise (١ يوم، ١١ يوم). */
const UNITS: Record<Lang, Record<"minute" | "day" | "month", [one: string, many: string]>> = {
  ckb: { minute: ["خولەک", "خولەک"], day: ["ڕۆژ", "ڕۆژ"], month: ["مانگ", "مانگ"] },
  ar: { minute: ["دقيقة", "دقائق"], day: ["يوم", "أيام"], month: ["شهر", "أشهر"] },
  en: { minute: ["min", "min"], day: ["day", "days"], month: ["month", "months"] },
};

function unit(lang: Lang, kind: "minute" | "day" | "month", n: number): string {
  const [one, many] = UNITS[lang][kind];
  const plural = lang === "ar" ? n >= 3 && n <= 10 : n !== 1;
  return `${digits(n, lang)} ${plural ? many : one}`;
}

const CURRENCY: Record<Lang, string> = { ckb: "دینار", ar: "دينار", en: "IQD" };

/** Wall-clock parts of an instant in a time zone. */
function zoned(iso: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return { dateKey: `${get("year")}-${get("month")}-${get("day")}`, hhmm: `${get("hour")}:${get("minute")}` };
}

/** Formatters bound to one language. Use `fmt(lang)` once per component. */
export function fmt(lang: Lang) {
  const time = (hhmm: string): string => {
    const [h, m] = hhmm.split(":").map(Number);
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${digits(h12, lang)}:${digits(String(m).padStart(2, "0"), lang)} ${AM_PM[lang][h < 12 ? 0 : 1]}`;
  };

  /** "2026-11-14" → "شەممە ١٤ تشرینی دووەم" / "Saturday 14 November" */
  const date = (dateKey: string): string => {
    const [y, m, d] = dateKey.split("-").map(Number);
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    return `${DAY_NAMES[lang][dow]} ${digits(d, lang)} ${MONTHS[lang][m - 1]}`;
  };

  return {
    lang,
    /** Digits only: 12 → "١٢" */
    num: (n: number | string) => digits(n, lang),
    /** 15000 → "١٥,٠٠٠ دینار" / "15,000 IQD" */
    iqd: (amount: number | null | undefined) =>
      amount == null ? "" : `${digits(amount.toLocaleString("en-US"), lang)} ${CURRENCY[lang]}`,
    /** "14:30" → "٢:٣٠ دوا نیوەڕۆ" / "2:30 PM" */
    time,
    date,
    /** 0 = Sunday … 6 = Saturday */
    day: (dow: number) => DAY_NAMES[lang][dow],
    minutes: (n: number) => unit(lang, "minute", n),
    days: (n: number) => unit(lang, "day", n),
    months: (n: number) => unit(lang, "month", n),
    /** An instant shown in the shop's time zone. */
    instant: (iso: string, timeZone: string) => {
      const z = zoned(iso, timeZone);
      return { dateKey: z.dateKey, date: date(z.dateKey), time: time(z.hhmm) };
    },
    /** Short date for tables: "٢٠٢٦-١٢-٠١" */
    shortDate: (iso: string | null | undefined, timeZone = "Asia/Baghdad") =>
      iso ? digits(zoned(iso, timeZone).dateKey, lang) : "—",
  };
}

export type Formatter = ReturnType<typeof fmt>;

/** Whole days from now until an instant (negative when it has passed). */
export function daysUntil(iso: string): number {
  return Math.ceil((Date.parse(iso) - Date.now()) / 86_400_000);
}

/**
 * Normalises an Iraqi phone number to international digits for wa.me links
 * and storage: "0770 146 6787" → "9647701466787". Returns null if invalid.
 */
export function normalizePhone(input: string): string | null {
  let d = input
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660)) // Arabic-Indic digits
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0)) // Persian-style digits
    .replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("07") && d.length === 11) d = `964${d.slice(1)}`;
  return /^[0-9]{7,15}$/.test(d) ? d : null;
}

/** "9647701466787" → "07701466787" (how people in Iraq write it) */
export function displayPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  return phone.startsWith("964") ? `0${phone.slice(3)}` : phone;
}

export function whatsappLink(phone: string, text?: string): string {
  const p = normalizePhone(phone) ?? phone;
  return `https://wa.me/${p}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** Fills {name}, {shop}, {date} … in a template (WhatsApp templates and dictionary strings). */
export function fill(body: string, vars: Record<string, string | number>): string {
  return body.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** Old name, kept for the WhatsApp template code. */
export const fillTemplate = fill;
