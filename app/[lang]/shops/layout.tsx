import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { ShopStrip } from "@/components/shop/theme";

// Customer side of the platform: the list of shops (the customer app opens
// here). zhewar's home-page look: white, barber-pole strip, red + blue.
// The red/blue come from the --shop-* defaults in globals.css.
export default async function ShopsLayout({ children }: LayoutProps<"/[lang]/shops">) {
  const { t, href } = await getI18n();
  return (
    <div className="flex min-h-dvh flex-col bg-white text-neutral-900">
      <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/90 shadow-sm backdrop-blur-md">
        <ShopStrip />
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-5">
          <Link href={href("/shops")} className="font-display text-lg font-bold" dir="ltr">
            <span style={{ color: "var(--shop-accent)" }}>Kurd</span>
            <span style={{ color: "var(--shop-primary)" }}>Booking</span>
          </Link>
          <LanguageSwitcher className="ms-auto" />
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <footer className="mt-20 border-t border-neutral-100 py-6 text-center text-xs text-neutral-400">
        <Link href={href("/")} className="hover:text-neutral-600" dir="ltr">KurdBooking</Link>
        <span className="mx-2">·</span>
        <Link href={href("/signup")} className="hover:text-neutral-600">{t.platform.start}</Link>
      </footer>
    </div>
  );
}
