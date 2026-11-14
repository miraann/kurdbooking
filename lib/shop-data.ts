import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { env } from "@/lib/env";
import type {
  GalleryPhoto, Location, Post, PublicReview, PublicShop, Service, ShopKind, ShopProfile, SocialLink, Staff, WorkingHours,
} from "@/lib/types";

// Cached reads for the public shop pages. They use the public client (no
// cookies), so they can be shared between all visitors. Dashboard actions
// call updateTag(shopTag(id)) after a change, so owners see edits at once.

export const shopTag = (shopId: string) => `shop-${shopId}`;
export const shopSlugTag = (slug: string) => `shop-slug-${slug}`;
/** The customer shops list (/shops). Any listing, status or branding change refreshes it. */
export const LISTED_SHOPS_TAG = "listed-shops";
export const isValidSlug = (slug: string) => /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(slug);

/** The support WhatsApp number (/super settings, else NEXT_PUBLIC_SUPPORT_WHATSAPP). */
export const PLATFORM_SETTINGS_TAG = "platform-settings";
export async function getSupportWhatsapp(): Promise<string> {
  "use cache";
  cacheLife("hours");
  cacheTag(PLATFORM_SETTINGS_TAG);

  const { data } = await createPublicClient().from("platform_settings").select("support_whatsapp").maybeSingle();
  return data?.support_whatsapp || env.supportWhatsapp();
}

export async function getPublicShop(slug: string): Promise<PublicShop | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(shopSlugTag(slug));

  const { data, error } = await createPublicClient().rpc("shop_by_slug", { p_slug: slug }).maybeSingle();
  if (error) throw error;
  return (data as PublicShop | null) ?? null;
}

export interface ListedShop {
  id: string;
  slug: string;
  name: string;
  kind: ShopKind;
  tagline: string | null;
  logo_url: string | null;
  cover_url: string | null;
  rating_avg: number | null;
  rating_count: number;
}

/** Shops shown in the customer list: live, listed by the owner, not hidden by you (0008 listed_shops). */
export async function getListedShops(kind: "barber" | "salon" | null, search: string): Promise<ListedShop[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(LISTED_SHOPS_TAG);

  const { data, error } = await createPublicClient().rpc("listed_shops", { p_kind: kind, p_search: search || null });
  if (error) throw error;
  return ((data ?? []) as (ListedShop & { rating_avg: number | string | null })[]).map((s) => ({
    ...s,
    rating_avg: s.rating_avg == null ? null : Number(s.rating_avg),
  }));
}

export interface ShopReviews {
  /** Average of the visible reviews, one decimal; null when there are none. */
  avg: number | null;
  count: number;
  latest: PublicReview[];
}

/** Rating and the newest visible reviews (0008 shop_rating / shop_reviews). */
export async function getShopReviews(shopId: string): Promise<ShopReviews> {
  "use cache";
  cacheLife("minutes");
  cacheTag(shopTag(shopId));

  const sb = createPublicClient();
  const [rating, latest] = await Promise.all([
    sb.rpc("shop_rating", { p_shop_id: shopId }).maybeSingle(),
    sb.rpc("shop_reviews", { p_shop_id: shopId, p_limit: 12 }),
  ]);
  if (rating.error) throw rating.error;
  if (latest.error) throw latest.error;
  const r = rating.data as { rating_avg: number | string | null; rating_count: number } | null;
  return {
    avg: r?.rating_avg == null ? null : Number(r.rating_avg),
    count: r?.rating_count ?? 0,
    latest: (latest.data ?? []) as PublicReview[],
  };
}

export interface ShopContent {
  profile: ShopProfile | null;
  services: Service[];
  staff: Staff[];
  staffServices: { staff_id: string; service_id: string }[];
  gallery: GalleryPhoto[];
  posts: Post[];
  links: SocialLink[];
  locations: Location[];
  hours: WorkingHours[];
}

export async function getShopContent(shopId: string): Promise<ShopContent> {
  "use cache";
  cacheLife("minutes");
  cacheTag(shopTag(shopId));

  const sb = createPublicClient();
  const byShop = <T,>(table: string, order = "sort_order") =>
    sb.from(table).select("*").eq("shop_id", shopId).order(order, { ascending: true }).then(({ data, error }) => {
      if (error) throw error;
      return (data ?? []) as T[];
    });

  const [profile, services, staff, staffServices, gallery, posts, links, locations, hours] = await Promise.all([
    sb.from("shop_profile").select("*").eq("shop_id", shopId).maybeSingle().then(({ data }) => data as ShopProfile | null),
    byShop<Service>("services"),
    byShop<Staff>("staff"),
    sb.from("staff_services").select("staff_id, service_id").eq("shop_id", shopId).then(({ data }) => data ?? []),
    byShop<GalleryPhoto>("gallery_photos"),
    byShop<Post>("posts"),
    byShop<SocialLink>("social_links"),
    byShop<Location>("locations"),
    byShop<WorkingHours>("working_hours", "day_of_week"),
  ]);

  return {
    profile,
    services: services.filter((s) => s.is_active),
    staff: staff.filter((s) => s.is_active),
    staffServices,
    gallery,
    posts,
    links,
    locations,
    hours: hours.filter((h) => h.staff_id === null),
  };
}
