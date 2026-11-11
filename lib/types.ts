// Row types for the tables in supabase/migrations. Hand-written for now;
// once the Supabase project exists you can generate exact types with
//   npx supabase gen types typescript --project-id <ref> > lib/database.types.ts

export type ShopKind = "barber" | "salon" | "both";
export type ShopStatus = "trial" | "active" | "past_due" | "suspended" | "cancelled";
export type MemberRole = "owner" | "manager" | "staff";
export type AppointmentStatus = "pending" | "confirmed" | "cancelled" | "completed" | "no_show";
export type PaymentMethod = "cash" | "fib" | "zaincash" | "fastpay" | "bank" | "other";

export interface Plan {
  id: string;
  name: string;
  description: string | null;
  price_iqd: number;
  period_months: number;
  max_staff: number | null;
  max_gallery_photos: number | null;
  max_locations: number | null;
  is_public: boolean;
  sort_order: number;
  created_at: string;
}

export interface Shop {
  id: string;
  slug: string;
  name: string;
  kind: ShopKind;
  status: ShopStatus;
  plan_id: string | null;
  trial_ends_at: string | null;
  paid_until: string | null;
  custom_domain: string | null;
  timezone: string;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublicShop {
  id: string;
  slug: string;
  name: string;
  kind: ShopKind;
  timezone: string;
  is_live: boolean;
}

export interface ShopProfile {
  shop_id: string;
  tagline: string | null;
  about: string | null;
  logo_url: string | null;
  cover_url: string | null;
  primary_color: string;
  accent_color: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  booking_enabled: boolean;
  auto_confirm: boolean;
  slot_interval_minutes: number;
  min_notice_minutes: number;
  max_days_ahead: number;
  updated_at: string;
}

export interface Location {
  id: string;
  shop_id: string;
  name: string;
  address: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  maps_url: string | null;
  phone: string | null;
  is_primary: boolean;
  sort_order: number;
}

export interface Service {
  id: string;
  shop_id: string;
  name: string;
  description: string | null;
  category: string | null;
  duration_minutes: number;
  price_iqd: number | null;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface Staff {
  id: string;
  shop_id: string;
  user_id: string | null;
  name: string;
  title: string | null;
  bio: string | null;
  photo_url: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface WorkingHours {
  id: string;
  shop_id: string;
  staff_id: string | null;
  day_of_week: number; // 0 = Sunday … 6 = Saturday
  is_open: boolean;
  open_time: string; // "HH:MM:SS"
  close_time: string;
  break_start: string | null;
  break_end: string | null;
}

export interface BlockedDate {
  id: string;
  shop_id: string;
  staff_id: string | null;
  date: string; // "YYYY-MM-DD"
  reason: string | null;
}

export interface GalleryPhoto {
  id: string;
  shop_id: string;
  image_url: string;
  caption: string | null;
  category: string | null;
  sort_order: number;
}

export type PostPlatform = "instagram" | "facebook" | "tiktok" | "snapchat" | "youtube" | "other";
export interface Post {
  id: string;
  shop_id: string;
  platform: PostPlatform;
  url: string;
  image_url: string | null;
  caption: string | null;
  posted_at: string | null;
  sort_order: number;
}

export type SocialPlatform = PostPlatform | "whatsapp" | "telegram" | "website";
export interface SocialLink {
  id: string;
  shop_id: string;
  platform: SocialPlatform;
  title: string | null;
  url: string;
  sort_order: number;
}

export interface WhatsAppTemplate {
  id: string;
  shop_id: string;
  kind: "accept" | "decline" | "reminder";
  title: string;
  body: string;
  sort_order: number;
}

export interface Customer {
  id: string;
  shop_id: string;
  full_name: string;
  phone: string;
  notes: string | null;
  created_at: string;
}

export interface Appointment {
  id: string;
  shop_id: string;
  customer_id: string;
  staff_id: string;
  service_id: string | null;
  location_id: string | null;
  service_name: string | null;
  duration_minutes: number;
  price_iqd: number | null;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  customer_note: string | null;
  public_token: string;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  shop_id: string;
  plan_id: string | null;
  amount_iqd: number;
  method: PaymentMethod;
  reference: string | null;
  note: string | null;
  months: number;
  period_start: string;
  period_end: string;
  paid_at: string;
}

export interface PlatformSettings {
  trial_days: number;
  grace_days: number;
  support_whatsapp: string | null;
}
