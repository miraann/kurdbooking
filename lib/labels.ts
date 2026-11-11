// Labels shared across the app, in every language: LABEL[value][lang].
// Wording rules (from the zhewar project): a women's salon is
// «ئارایشتگای خانمان» (never «ساڵۆن»), and the owner is never «سەرتاش».

import type { T3 } from "@/lib/i18n/config";
import type { AppointmentStatus, PaymentMethod, ShopKind, ShopStatus, SocialPlatform } from "@/lib/types";

export const SHOP_KIND: Record<ShopKind, T3> = {
  barber: { ckb: "دوکانی سەرتاشین", ar: "صالون حلاقة", en: "Barbershop" },
  salon: { ckb: "ئارایشتگای خانمان", ar: "صالون تجميل نسائي", en: "Women's salon" },
  both: { ckb: "هەردووکیان", ar: "كلاهما", en: "Both" },
};

export const SHOP_STATUS: Record<ShopStatus, T3> = {
  trial: { ckb: "تاقیکاری", ar: "تجريبي", en: "Trial" },
  active: { ckb: "چالاک", ar: "مفعّل", en: "Active" },
  past_due: { ckb: "کاتی پارەدان تێپەڕیوە", ar: "متأخر بالدفع", en: "Payment overdue" },
  suspended: { ckb: "ڕاگیراو", ar: "موقوف", en: "Suspended" },
  cancelled: { ckb: "هەڵوەشاوە", ar: "ملغى", en: "Cancelled" },
};

export const APPOINTMENT_STATUS: Record<AppointmentStatus, T3> = {
  pending: { ckb: "چاوەڕوان", ar: "قيد الانتظار", en: "Pending" },
  confirmed: { ckb: "پەسەندکراوە", ar: "مؤكد", en: "Confirmed" },
  cancelled: { ckb: "هەڵوەشاوە", ar: "ملغى", en: "Cancelled" },
  completed: { ckb: "تەواوبوو", ar: "مكتمل", en: "Completed" },
  no_show: { ckb: "نەهات", ar: "لم يحضر", en: "No-show" },
};

export const PAYMENT_METHOD: Record<PaymentMethod, T3> = {
  cash: { ckb: "کاش", ar: "نقداً", en: "Cash" },
  fib: { ckb: "FIB", ar: "FIB", en: "FIB" },
  zaincash: { ckb: "ZainCash", ar: "ZainCash", en: "ZainCash" },
  fastpay: { ckb: "FastPay", ar: "FastPay", en: "FastPay" },
  bank: { ckb: "بانک", ar: "تحويل بنكي", en: "Bank" },
  other: { ckb: "هیتر", ar: "أخرى", en: "Other" },
};

export const SOCIAL_PLATFORM: Record<SocialPlatform, T3> = {
  instagram: { ckb: "ئینستاگرام", ar: "إنستغرام", en: "Instagram" },
  facebook: { ckb: "فەیسبووک", ar: "فيسبوك", en: "Facebook" },
  tiktok: { ckb: "تیکتۆک", ar: "تيك توك", en: "TikTok" },
  snapchat: { ckb: "سناپچات", ar: "سناب شات", en: "Snapchat" },
  youtube: { ckb: "یوتیوب", ar: "يوتيوب", en: "YouTube" },
  whatsapp: { ckb: "واتسئاپ", ar: "واتساب", en: "WhatsApp" },
  telegram: { ckb: "تێلێگرام", ar: "تيليغرام", en: "Telegram" },
  website: { ckb: "ماڵپەڕ", ar: "موقع إلكتروني", en: "Website" },
  other: { ckb: "هیتر", ar: "أخرى", en: "Other" },
};
