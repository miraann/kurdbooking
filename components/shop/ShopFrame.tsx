import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus } from "lucide-react";
import { getPublicShop, getShopContent, isValidSlug } from "@/lib/shop-data";
import { shopBasePath } from "@/lib/tenant";
import { env } from "@/lib/env";
import { getI18n } from "@/lib/i18n/server";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { ShopStrip, StripeBackground } from "@/components/shop/theme";

/**
 * Wraps every public shop page: finds the shop, applies its colours, shows
 * the header (zhewar's ScrollNav look: barber-pole strip + white bar).
 * Closed (suspended) shops get a notice instead of the page.
 */
export async function ShopFrame({ params, children }: { params: Promise<{ shop: string }>; children: React.ReactNode }) {
  const { shop: slug } = await params;
  if (!isValidSlug(slug)) notFound();
  const [shop, { t, href }] = await Promise.all([getPublicShop(slug), getI18n()]);
  if (!shop) notFound();

  if (!shop.is_live) {
    return (
      <div className="grid min-h-dvh place-items-center bg-white px-6 text-center">
        <div>
          <h1 className="font-display text-3xl font-bold text-neutral-900">{shop.name}</h1>
          <p className="mt-3 text-neutral-500">{t.shop.closed}</p>
        </div>
      </div>
    );
  }

  const [{ profile }, base] = await Promise.all([getShopContent(shop.id), shopBasePath(slug)]);
  const style = {
    "--shop-primary": profile?.primary_color ?? "#2563eb",
    "--shop-accent": profile?.accent_color ?? "#ef4444",
  } as React.CSSProperties;

  return (
    <div style={style} className="relative isolate min-h-dvh text-neutral-900">
      <StripeBackground />
      <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/90 shadow-sm backdrop-blur-md">
        <ShopStrip kind={shop.kind} />
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-5 sm:gap-3">
          <Link href={href(base || "/")} className="flex min-w-0 items-center gap-2">
            {profile?.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.logo_url} alt="" className="size-8 rounded-full object-cover" />
            )}
            <span className="truncate font-display text-lg font-bold">{shop.name}</span>
          </Link>
          <nav className="ms-auto flex items-center gap-1 text-sm">
            <LanguageSwitcher className="hidden sm:inline-flex" />
            <Link href={href(`${base}/my-bookings`)} className="rounded-full px-3 py-2 font-medium text-neutral-500 hover:text-neutral-900">
              {t.shop.myBookings}
            </Link>
            <Link
              href={href(`${base}/book`)}
              className="flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 font-bold text-white transition active:scale-95"
              style={{ background: "var(--shop-primary)" }}
            >
              <CalendarPlus className="size-4" aria-hidden /> {t.shop.book}
            </Link>
          </nav>
        </div>
      </header>
      {children}
      <footer className="mt-20 flex flex-col items-center gap-3 border-t border-neutral-200/70 py-6 text-center text-xs text-neutral-400">
        {/* Phones: the language picker sits here, the header has no room. */}
        <LanguageSwitcher className="sm:hidden" />
        {/* On the shop's own subdomain, /shops lives on the main site. */}
        <Link href={base ? href("/shops") : `${env.siteUrl()}${href("/shops")}`} className="font-medium text-neutral-500 hover:text-neutral-900">
          {t.shops.allShops}
        </Link>
        <a href={env.siteUrl()} className="hover:text-neutral-600" dir="ltr">KurdBooking</a>
      </footer>
    </div>
  );
}
