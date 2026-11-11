import { Suspense } from "react";
import type { Metadata } from "next";
import { getI18n } from "@/lib/i18n/server";
import { DashboardNav } from "@/components/dashboard/DashboardNav";
import { ShopGate } from "@/components/dashboard/ShopGate";
import { PageSkeleton } from "@/components/ui/PageSkeleton";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.dashboard.metaTitle, robots: { index: false } };
}

// The navigation is static (instant). Everything that needs the logged-in
// owner streams inside the Suspense boundary.
export default function DashboardLayout({ children }: LayoutProps<"/[lang]/dashboard">) {
  return (
    <div className="min-h-dvh md:flex">
      <DashboardNav />
      {/* Bottom padding clears the floating tab bar on phones (zhewar's admin-bottomnav-clearance). */}
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] pt-6 md:px-8 md:pb-10">
        <Suspense fallback={<PageSkeleton />}>
          <ShopGate>{children}</ShopGate>
        </Suspense>
      </main>
    </div>
  );
}
