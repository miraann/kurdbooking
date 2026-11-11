import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { signOutSuper } from "@/app/[lang]/super/actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: t.super.badge,
    robots: { index: false },
    // "Add to Home Screen" on iPhone: needed there for push alerts.
    manifest: "/super.webmanifest",
    appleWebApp: { capable: true, title: "KB Admin" },
  };
}

const LINKS = [
  { href: "/super", key: "home" },
  { href: "/super/requests", key: "requests" },
  { href: "/super/shops", key: "shops" },
  { href: "/super/plans", key: "plans" },
  { href: "/super/settings", key: "settings" },
] as const;

export default async function SuperLayout({ children }: LayoutProps<"/[lang]/super">) {
  const { t, href } = await getI18n();
  return (
    <div className="min-h-dvh">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
          <Link href={href("/super")} className="text-lg font-bold text-slate-900">
            <span dir="ltr">Kurd<span className="text-brand-gradient">Booking</span></span>
            <span className="ms-2 rounded-md bg-brand px-2 py-0.5 text-xs text-white">{t.super.badge}</span>
          </Link>
          <nav className="flex flex-1 flex-wrap gap-1">
            {LINKS.map((l) => (
              <Link key={l.href} href={href(l.href)} className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
                {t.super.nav[l.key]}
              </Link>
            ))}
          </nav>
          <LanguageSwitcher />
          <form action={signOutSuper}>
            <button className="btn-ghost px-3 py-1.5 text-xs">{t.common.logout}</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Suspense fallback={<PageSkeleton />}>
          <SuperGate>{children}</SuperGate>
        </Suspense>
      </main>
    </div>
  );
}

async function SuperGate({ children }: { children: React.ReactNode }) {
  await requireSuperAdmin();
  return <>{children}</>;
}
