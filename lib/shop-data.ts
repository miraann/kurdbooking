import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import type {
  GalleryPhoto, Location, Post, PublicShop, Service, ShopProfile, SocialLink, Staff, WorkingHours,
} from "@/lib/types";

// Cached reads for the public shop pages. They use the public client (no
// cookies), so they can be shared between all visitors. Dashboard actions
// call updateTag(shopTag(id)) after a change, so owners see edits at once.

export const shopTag = (shopId: string) => `shop-${shopId}`;
export const shopSlugTag = (slug: string) => `shop-slug-${slug}`;
export const isValidSlug = (slug: string) => /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(slug);

export async function getPublicShop(slug: string): Promise<PublicShop | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(shopSlugTag(slug));

  const { data, error } = await createPublicClient().rpc("shop_by_slug", { p_slug: slug }).maybeSingle();
  if (error) throw error;
  return (data as PublicShop | null) ?? null;
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
