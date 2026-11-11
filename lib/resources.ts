// The shop's simple list content, described once. <ResourceEditor> renders
// the list + add/edit forms; app/[lang]/dashboard/actions.ts saves them. To add a
// new kind of list: add a table (migration + RLS), then an entry here.
// Texts are { ckb, ar, en } (see lib/i18n/config.ts → T3).

import type { Field } from "@/lib/fields";
import type { T3 } from "@/lib/i18n/config";
import { SOCIAL_PLATFORM } from "@/lib/labels";

export type ResourceKey =
  | "services"
  | "staff"
  | "gallery"
  | "posts"
  | "social_links"
  | "locations"
  | "blocked_dates"
  | "whatsapp_templates";

export interface ResourceConfig {
  table: string;
  addLabel: T3;
  emptyText: T3;
  fields: Field[];
  /** Column shown as the row title / image in the list. */
  titleField: string;
  subtitleFields?: string[];
  imageField?: string;
  orderBy: { column: string; ascending: boolean };
  /** Plan column that caps how many rows a shop may have. */
  limit?: "max_staff" | "max_gallery_photos" | "max_locations";
}

// Labels used by several lists.
const L = {
  name: { ckb: "ناو", ar: "الاسم", en: "Name" },
  image: { ckb: "وێنە", ar: "الصورة", en: "Image" },
  category: { ckb: "جۆر", ar: "الفئة", en: "Category" },
  description: { ckb: "وەسف", ar: "الوصف", en: "Description" },
  title: { ckb: "ناونیشان", ar: "العنوان", en: "Title" },
  platform: { ckb: "پلاتفۆرم", ar: "المنصة", en: "Platform" },
  date: { ckb: "بەروار", ar: "التاريخ", en: "Date" },
  phone: { ckb: "ژمارەی مۆبایل", ar: "رقم الموبايل", en: "Mobile number" },
} satisfies Record<string, T3>;

const sortOrder: Field = {
  name: "sort_order",
  label: { ckb: "ڕیزبەندی", ar: "الترتيب", en: "Order" },
  type: "number", min: 0, max: 9999, emptyValue: 0,
  help: { ckb: "ژمارەی بچووکتر پێشتر دێت", ar: "الرقم الأصغر يظهر أولاً", en: "Smaller numbers come first" },
};
const postPlatforms = (["instagram", "facebook", "tiktok", "snapchat", "youtube", "other"] as const).map((v) => ({ value: v, label: SOCIAL_PLATFORM[v] }));
const linkPlatforms = (Object.keys(SOCIAL_PLATFORM) as (keyof typeof SOCIAL_PLATFORM)[]).map((v) => ({ value: v, label: SOCIAL_PLATFORM[v] }));

export const RESOURCES: Record<ResourceKey, ResourceConfig> = {
  services: {
    table: "services",
    addLabel: { ckb: "خزمەتگوزاری نوێ", ar: "خدمة جديدة", en: "New service" },
    emptyText: { ckb: "هێشتا هیچ خزمەتگوزارییەک زیاد نەکراوە", ar: "لم تتم إضافة أي خدمة بعد", en: "No services added yet" },
    titleField: "name",
    subtitleFields: ["duration_minutes", "price_iqd"],
    imageField: "image_url",
    orderBy: { column: "sort_order", ascending: true },
    fields: [
      { name: "name", label: L.name, type: "text", required: true, maxLength: 80, placeholder: { ckb: "بۆ نموونە: قژبڕین", ar: "مثلاً: قص الشعر", en: "e.g. Haircut" } },
      { name: "duration_minutes", label: { ckb: "ماوە (خولەک)", ar: "المدة (دقيقة)", en: "Duration (minutes)" }, type: "number", required: true, min: 5, max: 600, step: 5 },
      { name: "price_iqd", label: { ckb: "نرخ (دینار)", ar: "السعر (دينار)", en: "Price (IQD)" }, type: "number", min: 0, step: 250 },
      { name: "category", label: L.category, type: "text", maxLength: 40, placeholder: { ckb: "قژ، ڕیش، ڕەنگ…", ar: "شعر، لحية، صبغ…", en: "Hair, beard, colour…" } },
      { name: "description", label: L.description, type: "textarea", maxLength: 500 },
      { name: "image_url", label: L.image, type: "image", folder: "services" },
      { name: "is_active", label: { ckb: "پیشان بدرێت", ar: "إظهار", en: "Show it" }, type: "checkbox", defaultChecked: true },
      sortOrder,
    ],
  },

  staff: {
    table: "staff",
    addLabel: { ckb: "کارمەندی نوێ", ar: "موظف جديد", en: "New staff member" },
    emptyText: { ckb: "هیچ کارمەندێک نییە", ar: "لا يوجد موظفون", en: "No staff yet" },
    titleField: "name",
    subtitleFields: ["title"],
    imageField: "photo_url",
    orderBy: { column: "sort_order", ascending: true },
    limit: "max_staff",
    fields: [
      { name: "name", label: L.name, type: "text", required: true, maxLength: 80 },
      { name: "title", label: { ckb: "پلە / ناونیشان", ar: "المسمى", en: "Job title" }, type: "text", maxLength: 60, placeholder: { ckb: "بۆ نموونە: وەستا", ar: "مثلاً: أسطة", en: "e.g. Master barber" } },
      { name: "bio", label: { ckb: "دەربارە", ar: "نبذة", en: "About" }, type: "textarea", maxLength: 500 },
      { name: "photo_url", label: L.image, type: "image", folder: "staff" },
      { name: "is_active", label: { ckb: "چالاکە (دەتوانرێت کاتی لەلا بگیرێت)", ar: "مفعّل (يمكن الحجز لديه)", en: "Active (can be booked)" }, type: "checkbox", defaultChecked: true },
      sortOrder,
    ],
  },

  gallery: {
    table: "gallery_photos",
    addLabel: { ckb: "وێنەی نوێ", ar: "صورة جديدة", en: "New photo" },
    emptyText: { ckb: "گالەری بەتاڵە", ar: "المعرض فارغ", en: "The gallery is empty" },
    titleField: "caption",
    imageField: "image_url",
    orderBy: { column: "sort_order", ascending: true },
    limit: "max_gallery_photos",
    fields: [
      { name: "image_url", label: L.image, type: "image", folder: "gallery", required: true },
      { name: "caption", label: L.title, type: "text", maxLength: 120 },
      { name: "category", label: L.category, type: "text", maxLength: 40 },
      sortOrder,
    ],
  },

  posts: {
    table: "posts",
    addLabel: { ckb: "پۆستی نوێ", ar: "منشور جديد", en: "New post" },
    emptyText: { ckb: "هیچ پۆستێک نییە", ar: "لا توجد منشورات", en: "No posts yet" },
    titleField: "caption",
    subtitleFields: ["platform"],
    imageField: "image_url",
    orderBy: { column: "sort_order", ascending: true },
    fields: [
      { name: "platform", label: L.platform, type: "select", required: true, options: postPlatforms },
      { name: "url", label: { ckb: "لینکی پۆست", ar: "رابط المنشور", en: "Post link" }, type: "url", required: true, placeholder: "https://www.instagram.com/p/…" },
      { name: "image_url", label: { ckb: "وێنەی پۆست", ar: "صورة المنشور", en: "Post image" }, type: "image", folder: "posts" },
      { name: "caption", label: { ckb: "دەق", ar: "النص", en: "Text" }, type: "textarea", maxLength: 500 },
      { name: "posted_at", label: L.date, type: "date" },
      sortOrder,
    ],
  },

  social_links: {
    table: "social_links",
    addLabel: { ckb: "لینکی نوێ", ar: "رابط جديد", en: "New link" },
    emptyText: { ckb: "هیچ لینکێک نییە", ar: "لا توجد روابط", en: "No links yet" },
    titleField: "platform",
    subtitleFields: ["url"],
    orderBy: { column: "sort_order", ascending: true },
    fields: [
      { name: "platform", label: L.platform, type: "select", required: true, options: linkPlatforms },
      { name: "url", label: { ckb: "لینک", ar: "الرابط", en: "Link" }, type: "url", required: true },
      { name: "title", label: { ckb: "ناونیشان (ئارەزوومەندانە)", ar: "العنوان (اختياري)", en: "Title (optional)" }, type: "text", maxLength: 60 },
      sortOrder,
    ],
  },

  locations: {
    table: "locations",
    addLabel: { ckb: "شوێنی نوێ", ar: "موقع جديد", en: "New location" },
    emptyText: { ckb: "هیچ شوێنێک زیاد نەکراوە", ar: "لم تتم إضافة أي موقع", en: "No locations added" },
    titleField: "name",
    subtitleFields: ["address", "city"],
    orderBy: { column: "sort_order", ascending: true },
    limit: "max_locations",
    fields: [
      { name: "name", label: { ckb: "ناوی لق", ar: "اسم الفرع", en: "Branch name" }, type: "text", required: true, maxLength: 80, placeholder: { ckb: "بۆ نموونە: لقی سەرەکی", ar: "مثلاً: الفرع الرئيسي", en: "e.g. Main branch" } },
      { name: "address", label: { ckb: "ناونیشان", ar: "العنوان", en: "Address" }, type: "text", maxLength: 200 },
      { name: "city", label: { ckb: "شار", ar: "المدينة", en: "City" }, type: "text", maxLength: 60 },
      {
        name: "maps_url", label: { ckb: "لینکی گووگڵ ماپ", ar: "رابط خرائط Google", en: "Google Maps link" }, type: "url",
        help: { ckb: "لە گووگڵ ماپ «Share» بکە و لینکەکە لێرە دابنێ", ar: "اضغط «Share» في خرائط Google والصق الرابط هنا", en: "Tap «Share» in Google Maps and paste the link here" },
      },
      { name: "lat", label: "Latitude", type: "number", step: "any", min: -90, max: 90 },
      { name: "lng", label: "Longitude", type: "number", step: "any", min: -180, max: 180 },
      { name: "phone", label: L.phone, type: "tel" },
      { name: "is_primary", label: { ckb: "شوێنی سەرەکی", ar: "الموقع الرئيسي", en: "Main location" }, type: "checkbox" },
      sortOrder,
    ],
  },

  blocked_dates: {
    table: "blocked_dates",
    addLabel: { ckb: "ڕۆژی پشوو", ar: "يوم عطلة", en: "Day off" },
    emptyText: { ckb: "هیچ ڕۆژێکی پشوو دیاری نەکراوە", ar: "لم يتم تحديد أي يوم عطلة", en: "No days off set" },
    titleField: "date",
    subtitleFields: ["reason"],
    orderBy: { column: "date", ascending: true },
    fields: [
      { name: "date", label: L.date, type: "date", required: true },
      { name: "reason", label: { ckb: "هۆکار", ar: "السبب", en: "Reason" }, type: "text", maxLength: 120, placeholder: { ckb: "بۆ نموونە: جەژن", ar: "مثلاً: العيد", en: "e.g. Eid" } },
    ],
  },

  whatsapp_templates: {
    table: "whatsapp_templates",
    addLabel: { ckb: "نامەی نوێ", ar: "رسالة جديدة", en: "New message" },
    emptyText: { ckb: "هیچ نامەیەک نییە", ar: "لا توجد رسائل", en: "No messages yet" },
    titleField: "title",
    subtitleFields: ["kind"],
    orderBy: { column: "sort_order", ascending: true },
    fields: [
      {
        name: "kind", label: { ckb: "جۆر", ar: "النوع", en: "Type" }, type: "select", required: true,
        options: [
          { value: "accept", label: { ckb: "پەسەندکردن", ar: "تأكيد", en: "Confirm" } },
          { value: "decline", label: { ckb: "ڕەتکردنەوە", ar: "رفض", en: "Decline" } },
          { value: "reminder", label: { ckb: "بیرخستنەوە", ar: "تذكير", en: "Reminder" } },
        ],
      },
      { name: "title", label: L.title, type: "text", required: true, maxLength: 80 },
      {
        name: "body", label: { ckb: "دەقی نامە", ar: "نص الرسالة", en: "Message text" }, type: "textarea", required: true, maxLength: 1000,
        help: {
          ckb: "{name} {shop} {date} {time} {link} خۆکارانە پڕ دەکرێنەوە",
          ar: "{name} {shop} {date} {time} {link} تُملأ تلقائياً",
          en: "{name} {shop} {date} {time} {link} are filled in automatically",
        },
      },
      sortOrder,
    ],
  },
};

export const isResourceKey = (k: string): k is ResourceKey => k in RESOURCES;
