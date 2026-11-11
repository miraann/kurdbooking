import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";

export default async function PlatformLayout({ children }: LayoutProps<"/[lang]">) {
  const { t, href } = await getI18n();
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3">
          <Link href={href("/")} className="shrink-0 text-lg font-bold text-slate-900 sm:text-xl" dir="ltr">
            Kurd<span className="text-brand-gradient">Booking</span>
          </Link>
          <nav className="ms-auto flex min-w-0 items-center gap-1 text-sm sm:gap-2">
            <LanguageSwitcher />
            <Link href={href("/pricing")} className="hidden rounded-xl px-3 py-2 font-medium text-slate-500 hover:bg-white sm:block">{t.platform.pricing}</Link>
            <Link href={href("/login")} className="rounded-xl px-2 py-2 font-medium text-slate-500 hover:bg-white sm:px-3">{t.platform.login}</Link>
            <Link href={href("/signup")} className="btn-primary min-h-10 px-4 py-2">{t.platform.start}</Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-slate-200/70 py-6 text-center text-xs text-slate-500" dir="ltr">
        KurdBooking · miranbarzanji.site
      </footer>
    </div>
  );
}
