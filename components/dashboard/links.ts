import {
  CalendarCheck, CalendarClock, Contact, CreditCard, Home, Images, LayoutGrid, Megaphone, Palette, Scissors, Settings, Star, Users,
} from "lucide-react";
import type { T3 } from "@/lib/i18n/config";

// Dashboard sections. `tab` = shown in the phone tab bar; the rest are on
// /dashboard/more. hrefs are without the language prefix: wrap them in href().
// (Plain module, so server and client components can both use it.)
export const DASHBOARD_LINKS: { href: string; label: T3; short: T3; icon: typeof Home; tab: boolean }[] = [
  { href: "/dashboard", label: { ckb: "سەرەکی", ar: "الرئيسية", en: "Home" }, short: { ckb: "سەرەکی", ar: "الرئيسية", en: "Home" }, icon: Home, tab: true },
  { href: "/dashboard/appointments", label: { ckb: "کاتەکانی سەردانیکردن", ar: "المواعيد", en: "Appointments" }, short: { ckb: "کاتەکان", ar: "المواعيد", en: "Bookings" }, icon: CalendarCheck, tab: true },
  { href: "/dashboard/services", label: { ckb: "خزمەتگوزارییەکان", ar: "الخدمات", en: "Services" }, short: { ckb: "خزمەت", ar: "الخدمات", en: "Services" }, icon: Scissors, tab: true },
  { href: "/dashboard/schedule", label: { ckb: "کاتی کار و پشوو", ar: "أوقات العمل والعطل", en: "Hours and days off" }, short: { ckb: "خشتە", ar: "الجدول", en: "Hours" }, icon: CalendarClock, tab: true },
  { href: "/dashboard/staff", label: { ckb: "کارمەندان", ar: "الموظفون", en: "Staff" }, short: { ckb: "کارمەند", ar: "الموظفون", en: "Staff" }, icon: Users, tab: false },
  { href: "/dashboard/gallery", label: { ckb: "گالەری", ar: "المعرض", en: "Gallery" }, short: { ckb: "گالەری", ar: "المعرض", en: "Gallery" }, icon: Images, tab: false },
  { href: "/dashboard/posts", label: { ckb: "پۆستەکان", ar: "المنشورات", en: "Posts" }, short: { ckb: "پۆست", ar: "المنشورات", en: "Posts" }, icon: Megaphone, tab: false },
  { href: "/dashboard/reviews", label: { ckb: "هەڵسەنگاندنەکان", ar: "التقييمات", en: "Reviews" }, short: { ckb: "هەڵسەنگاندن", ar: "التقييمات", en: "Reviews" }, icon: Star, tab: false },
  { href: "/dashboard/contact", label: { ckb: "پەیوەندی و شوێن", ar: "التواصل والموقع", en: "Contact and location" }, short: { ckb: "پەیوەندی", ar: "التواصل", en: "Contact" }, icon: Contact, tab: false },
  { href: "/dashboard/profile", label: { ckb: "ناسنامە و ڕەنگ", ar: "الهوية والألوان", en: "Profile and colours" }, short: { ckb: "پرۆفایل", ar: "الهوية", en: "Profile" }, icon: Palette, tab: false },
  { href: "/dashboard/settings", label: { ckb: "ڕێکخستنەکان", ar: "الإعدادات", en: "Settings" }, short: { ckb: "ڕێکخستن", ar: "الإعدادات", en: "Settings" }, icon: Settings, tab: false },
  { href: "/dashboard/billing", label: { ckb: "بەشداریکردن", ar: "الاشتراك", en: "Subscription" }, short: { ckb: "بەشداری", ar: "الاشتراك", en: "Plan" }, icon: CreditCard, tab: false },
];

export const MORE_LINK = {
  href: "/dashboard/more",
  label: { ckb: "زیاتر", ar: "المزيد", en: "More" },
  short: { ckb: "زیاتر", ar: "المزيد", en: "More" },
  icon: LayoutGrid,
  tab: true,
};
