// Field lists for the single-record forms (shop profile, booking settings,
// plans, platform settings, payments). Lists of rows are in lib/resources.ts.
// Texts are { ckb, ar, en } (see lib/i18n/config.ts → T3).

import type { Field } from "@/lib/fields";
import type { T3 } from "@/lib/i18n/config";
import { PAYMENT_METHOD } from "@/lib/labels";

const UNLIMITED_HELP: T3 = { ckb: "بەتاڵ = بێسنوور", ar: "فارغ = غير محدود", en: "Empty = unlimited" };
const PRICE: T3 = { ckb: "نرخ (دینار)", ar: "السعر (دينار)", en: "Price (IQD)" };

export const PROFILE_FIELDS: Field[] = [
  { name: "name", label: { ckb: "ناوی دوکان", ar: "اسم المحل", en: "Shop name" }, type: "text", required: true, maxLength: 80 },
  { name: "tagline", label: { ckb: "دروشم", ar: "الشعار النصي", en: "Tagline" }, type: "text", maxLength: 120, placeholder: { ckb: "یەک ڕستەی کورت لەسەر دوکانەکەت", ar: "جملة قصيرة عن محلك", en: "One short line about your shop" } },
  { name: "about", label: { ckb: "دەربارەی ئێمە", ar: "من نحن", en: "About us" }, type: "textarea", maxLength: 1500 },
  { name: "logo_url", label: { ckb: "لۆگۆ", ar: "الشعار", en: "Logo" }, type: "image", folder: "branding" },
  { name: "cover_url", label: { ckb: "وێنەی سەرەوە", ar: "صورة الغلاف", en: "Cover image" }, type: "image", folder: "branding" },
  { name: "primary_color", label: { ckb: "ڕەنگی سەرەکی", ar: "اللون الرئيسي", en: "Main colour" }, type: "color" },
  { name: "accent_color", label: { ckb: "ڕەنگی دووەم", ar: "اللون الثانوي", en: "Second colour" }, type: "color" },
  { name: "phone", label: { ckb: "ژمارەی مۆبایل", ar: "رقم الموبايل", en: "Mobile number" }, type: "tel" },
  { name: "whatsapp", label: { ckb: "ژمارەی واتسئاپ", ar: "رقم الواتساب", en: "WhatsApp number" }, type: "tel" },
  { name: "email", label: { ckb: "ئیمەیڵ", ar: "البريد الإلكتروني", en: "Email" }, type: "email" },
];

export const BOOKING_FIELDS: Field[] = [
  { name: "booking_enabled", label: { ckb: "کاتگرتنی ئۆنلاین چالاکە", ar: "الحجز أونلاين مفعّل", en: "Online booking is on" }, type: "checkbox" },
  { name: "auto_confirm", label: { ckb: "پەسەندکردنی خۆکار (بێ چاوەڕوانی)", ar: "تأكيد تلقائي (بدون انتظار)", en: "Confirm automatically (no waiting)" }, type: "checkbox" },
  { name: "slot_interval_minutes", label: { ckb: "ماوەی نێوان کاتەکان (خولەک)", ar: "الفاصل بين الأوقات (دقيقة)", en: "Time between slots (minutes)" }, type: "number", required: true, min: 5, max: 240, step: 5 },
  { name: "min_notice_minutes", label: { ckb: "لانیکەم چەند خولەک پێشتر", ar: "أقل مدة قبل الموعد (دقيقة)", en: "Minimum notice (minutes)" }, type: "number", required: true, min: 0, max: 10080, step: 5 },
  { name: "max_days_ahead", label: { ckb: "تا چەند ڕۆژ دواتر دەتوانرێت کات بگیرێت", ar: "الحجز مسموح حتى كم يوماً مقدماً", en: "How many days ahead people can book" }, type: "number", required: true, min: 1, max: 365 },
];

export const APP_FIELDS: Field[] = [
  {
    name: "listed",
    label: { ckb: "پیشاندان لە ئەپ", ar: "الظهور في التطبيق", en: "Show in the app" },
    help: {
      ckb: "کاتێک کراوەیە، دوکانەکەت لە لیستی دوکانەکانی ئەپی کڕیاران دەردەکەوێت. بە لینک و QR هەمیشە دەکرێتەوە.",
      ar: "عند التفعيل يظهر محلك في قائمة المحلات في تطبيق الزبائن. يفتح دائماً عبر الرابط وQR.",
      en: "When on, your shop appears in the shop list of the customer app. It always opens by link and QR.",
    },
    type: "checkbox",
    defaultChecked: true,
  },
];

export const REPLY_FIELDS: Field[] = [
  { name: "reply", label: { ckb: "وەڵام (تەنها یەک جار)", ar: "الرد (مرة واحدة فقط)", en: "Reply (once only)" }, type: "textarea", required: true, maxLength: 1000 },
];

export const PLAN_FIELDS: Field[] = [
  { name: "name", label: { ckb: "ناوی پلان", ar: "اسم الباقة", en: "Plan name" }, type: "text", required: true, maxLength: 60 },
  { name: "price_iqd", label: PRICE, type: "number", required: true, min: 0, step: 250 },
  { name: "period_months", label: { ckb: "ماوە (مانگ)", ar: "المدة (أشهر)", en: "Period (months)" }, type: "number", required: true, min: 1, max: 36 },
  { name: "description", label: { ckb: "وەسف", ar: "الوصف", en: "Description" }, type: "textarea", maxLength: 1000 },
  { name: "max_staff", label: { ckb: "زۆرترین کارمەند", ar: "أقصى عدد للموظفين", en: "Max staff" }, type: "number", min: 1, help: UNLIMITED_HELP },
  { name: "max_gallery_photos", label: { ckb: "زۆرترین وێنەی گالەری", ar: "أقصى عدد لصور المعرض", en: "Max gallery photos" }, type: "number", min: 1, help: UNLIMITED_HELP },
  { name: "max_locations", label: { ckb: "زۆرترین لق", ar: "أقصى عدد للفروع", en: "Max branches" }, type: "number", min: 1, help: UNLIMITED_HELP },
  { name: "is_public", label: { ckb: "لە لاپەڕەی نرخەکان پیشان بدرێت", ar: "إظهارها في صفحة الأسعار", en: "Show on the pricing page" }, type: "checkbox", defaultChecked: true },
  { name: "sort_order", label: { ckb: "ڕیزبەندی", ar: "الترتيب", en: "Order" }, type: "number", min: 0, emptyValue: 0 },
];

export const PLATFORM_SETTINGS_FIELDS: Field[] = [
  { name: "trial_days", label: { ckb: "ڕۆژانی تاقیکاری بۆ دوکانی نوێ", ar: "أيام التجربة للمحل الجديد", en: "Trial days for new shops" }, type: "number", required: true, min: 0, max: 365 },
  {
    name: "grace_days", label: { ckb: "ڕۆژانی مۆڵەت دوای کۆتایی", ar: "أيام السماح بعد الانتهاء", en: "Grace days after the end" }, type: "number", required: true, min: 0, max: 60,
    help: { ckb: "دوای ئەم ڕۆژانە دوکان ڕادەگیرێت", ar: "بعد هذه الأيام يتم إيقاف المحل", en: "After these days the shop is suspended" },
  },
  { name: "support_whatsapp", label: { ckb: "واتسئاپی پشتگیری", ar: "واتساب الدعم", en: "Support WhatsApp" }, type: "tel" },
];

export const PAYMENT_FIELDS = (plans: { id: string; name: string }[]): Field[] => [
  { name: "plan_id", label: { ckb: "پلان", ar: "الباقة", en: "Plan" }, type: "select", options: plans.map((p) => ({ value: p.id, label: p.name })) },
  { name: "months", label: { ckb: "چەند مانگ", ar: "عدد الأشهر", en: "Months" }, type: "number", required: true, min: 1, max: 36 },
  { name: "amount_iqd", label: { ckb: "بڕی پارە (دینار)", ar: "المبلغ (دينار)", en: "Amount (IQD)" }, type: "number", required: true, min: 0, step: 250 },
  {
    name: "method", label: { ckb: "شێوازی پارەدان", ar: "طريقة الدفع", en: "Payment method" }, type: "select", required: true,
    options: (Object.keys(PAYMENT_METHOD) as (keyof typeof PAYMENT_METHOD)[]).map((v) => ({ value: v, label: PAYMENT_METHOD[v] })),
  },
  { name: "reference", label: { ckb: "ژمارەی وەسڵ / ترانزاکشن", ar: "رقم الوصل / المعاملة", en: "Receipt / transaction number" }, type: "text", maxLength: 120 },
  { name: "note", label: { ckb: "تێبینی", ar: "ملاحظة", en: "Note" }, type: "text", maxLength: 300 },
];

/** Super admin → extend a shop's trial. */
export const TRIAL_FIELDS: Field[] = [
  { name: "days", label: { ckb: "چەند ڕۆژ", ar: "عدد الأيام", en: "Days" }, type: "number", required: true, min: 1, max: 365 },
];
