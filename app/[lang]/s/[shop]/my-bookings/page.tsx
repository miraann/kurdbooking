import type { Metadata } from "next";
import { Search } from "lucide-react";
import { shopBasePath } from "@/lib/tenant";
import { getI18n } from "@/lib/i18n/server";
import { RING } from "@/components/shop/theme";
import { MyBookings } from "./MyBookings";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.shop.myBookings, robots: { index: false } };
}

export default async function MyBookingsPage({ params }: PageProps<"/[lang]/s/[shop]/my-bookings">) {
  const { shop: slug } = await params;
  const [base, { t }] = await Promise.all([shopBasePath(slug), getI18n()]);
  return (
    <main className="mx-auto max-w-md px-4 pt-12">
      {/* zhewar header: search mark in a red/blue ring */}
      <div className="mb-6 space-y-1 text-center">
        <div className="mb-4 flex justify-center">
          <div className="size-12 rounded-2xl p-[2.5px]" style={{ background: RING }}>
            <div className="grid size-full place-items-center rounded-[13px] bg-white">
              <Search className="size-5" style={{ color: "var(--shop-primary)" }} aria-hidden />
            </div>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-neutral-900">{t.shop.myBookings}</h1>
        <p className="text-sm text-neutral-500">{t.myBookings.subtitle}</p>
      </div>
      <MyBookings slug={slug} base={base} />
    </main>
  );
}
