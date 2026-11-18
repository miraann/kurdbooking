import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { ShopStrip, StripeBackground } from "@/components/shop/theme";
import { AppDownload } from "@/components/shop/AppDownload";
import { CustomerHeaderLinks, CustomerTabBar } from "@/components/customer/CustomerNav";

// Customer side of the platform: the site's home page is the list of shops
// (the customer app opens here), plus the customer's favourites, notifications
// and profile. Phones (and the customer app) get a floating tab bar at the
// bottom, tablets and desktops get the same links in the header.
// zhewar's home-page look: white, barber-pole strip, red + blue. The red/blue
// come from the --shop-* defaults in globals.css.
//
// Shop owners don't see sales pages here: /signup and /login work by direct
// link, and the owner app opens /dashboard.
export default async function CustomerLayout({ children }: LayoutProps<"/[lang]">) {
  const { href } = await getI18n();
  return (
    // max-md:pb-28: room for the tab bar under the page's last line.
    <div className="relative isolate flex min-h-dvh flex-col text-neutral-900 max-md:pb-28">
      <StripeBackground />
      <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/90 shadow-sm backdrop-blur-md">
        <ShopStrip />
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-5">
          <Link href={href("/")} className="font-display text-lg font-bold" dir="ltr">
            <span style={{ color: "var(--shop-accent)" }}>Kurd</span>
            <span style={{ color: "var(--shop-primary)" }}>Booking</span>
          </Link>
          <LanguageSwitcher className="ms-auto" />
          <CustomerHeaderLinks />
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <footer className="mt-20 flex flex-col items-center gap-3 border-t border-neutral-100 py-6 text-center text-xs text-neutral-400">
        {/* The customer Android app (browsers only). */}
        <AppDownload />
        <span dir="ltr">KurdBooking</span>
      </footer>
      <CustomerTabBar />
    </div>
  );
}
