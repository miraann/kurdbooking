"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { splitLocale } from "@/lib/i18n/config";
import { DASHBOARD_LINKS, MORE_LINK } from "@/components/dashboard/links";
import { useI18n } from "@/components/i18n/I18nProvider";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";

/**
 * Sidebar (desktop) and pill tab bar (phones). The active link comes from the
 * URL, which isn't known while prerendering a page with an unknown [id]
 * (e.g. /dashboard/staff/<id>): there the nav first renders without a
 * highlight and streams in (Cache Components rule for usePathname).
 */
export function DashboardNav() {
  return (
    <Suspense fallback={<NavView pathname={null} />}>
      <NavAtPath />
    </Suspense>
  );
}

function NavAtPath() {
  return <NavView pathname={splitLocale(usePathname()).path} />; // without /ar or /en
}

function NavView({ pathname }: { pathname: string | null }) {
  const { lang, href } = useI18n();
  const isActive = (to: string) => pathname !== null && (to === "/dashboard" ? pathname === to : pathname.startsWith(to));
  const tabs = [...DASHBOARD_LINKS.filter((l) => l.tab), MORE_LINK];
  // On a section that isn't in the tab bar, light up «زیاتر».
  const onTab = tabs.some((t) => t.href !== MORE_LINK.href && isActive(t.href));

  return (
    <>
      {/* Desktop / tablet sidebar (right side in RTL, left in LTR) */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-e border-slate-100 bg-white p-4 md:flex">
        <Link href={href("/dashboard")} className="mb-6 px-3 text-xl font-bold text-slate-900" dir="ltr">
          Kurd<span className="text-brand-gradient">Booking</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto scrollbar-hide">
          {DASHBOARD_LINKS.map(({ href: to, label, icon: Icon }) => {
            const active = isActive(to);
            return (
              <Link
                key={to}
                href={href(to)}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-all duration-200 ${
                  active ? "bg-indigo-50 font-bold text-indigo-600" : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                <Icon className="size-5" strokeWidth={active ? 2.4 : 2} aria-hidden />
                {label[lang]}
              </Link>
            );
          })}
        </nav>
        <LanguageSwitcher className="mt-2" />
      </aside>

      {/* Phone: zhewar's floating pill tab bar. The active tab grows into an
          indigo pill with its label; the others stay icon-only. */}
      <nav
        className="fixed inset-x-4 z-40 mx-auto max-w-[480px] rounded-full border border-slate-200/60 bg-white/80 shadow-md-2 backdrop-blur-xl md:hidden"
        style={{ bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="flex items-center gap-0.5 p-1.5">
          {tabs.map(({ href: to, short, icon: Icon }) => {
            const active = to === MORE_LINK.href ? pathname !== null && !onTab : isActive(to);
            return (
              <Link
                key={to}
                href={href(to)}
                aria-label={short[lang]}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-12 touch-manipulation select-none items-center justify-center gap-1.5 rounded-full transition-all duration-300 ease-out active:scale-90 ${
                  active ? "flex-none bg-indigo-50 px-4 font-bold text-indigo-600" : "min-w-0 flex-1 text-slate-400 active:bg-slate-100/80"
                }`}
              >
                <Icon className="size-5 shrink-0" strokeWidth={active ? 2.4 : 2} aria-hidden />
                {active && <span key={to} className="animate-nav-label-in whitespace-nowrap text-xs leading-none">{short[lang]}</span>}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
