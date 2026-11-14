import Link from "next/link";
import { UserRound } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { ShopStrip, StripeBackground } from "@/components/shop/theme";
import { AppDownload } from "@/components/shop/AppDownload";

// Customer side of the platform: the site's home page is the list of shops
// (the customer app opens here), plus the customer's profile at /account.
// zhewar's home-page look: white, barber-pole strip, red + blue. The red/blue
// come from the --shop-* defaults in globals.css.
//
// Shop owners don't see sales pages here: /signup and /login work by direct
// link, and the owner app opens /dashboard.
export default async function CustomerLayout({ children }: LayoutProps<"/[lang]">) {
  const { t, href } = await getI18n();
  return (
    <div className="relative isolate flex min-h-dvh flex-col text-neutral-900">
      <StripeBackground />
      <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/90 shadow-sm backdrop-blur-md">
        <ShopStrip />
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-5">
          <Link href={href("/")} className="font-display text-lg font-bold" dir="ltr">
            <span style={{ color: "var(--shop-accent)" }}>Kurd</span>
            <span style={{ color: "var(--shop-primary)" }}>Booking</span>
          </Link>
          <LanguageSwitcher className="ms-auto" />
          <Link
            href={href("/account")}
            className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-bold text-white transition active:scale-95"
            style={{ background: "var(--shop-primary)" }}
          >
            <UserRound className="size-4" aria-hidden />
            <span className="max-sm:sr-only">{t.account.link}</span>
          </Link>
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <footer className="mt-20 flex flex-col items-center gap-3 border-t border-neutral-100 py-6 text-center text-xs text-neutral-400">
        {/* The customer Android app (browsers only). */}
        <AppDownload />
        <span dir="ltr">KurdBooking</span>
      </footer>
    </div>
  );
}
