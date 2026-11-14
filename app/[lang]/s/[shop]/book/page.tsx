import type { Metadata } from "next";
import { getI18n } from "@/lib/i18n/server";
import { connection } from "next/server";
import { getPublicShop, getShopContent } from "@/lib/shop-data";
import { shopBasePath } from "@/lib/tenant";
import { todayKey } from "@/lib/booking";
import { getViewer } from "@/lib/customer";
import { Heading } from "@/components/shop/theme";
import { BookingForm } from "./BookingForm";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.booking.metaTitle };
}

export default async function BookPage({ params }: PageProps<"/[lang]/s/[shop]/book">) {
  await connection(); // "today" depends on the request time, so never prerender this page
  const { shop: slug } = await params;
  const shop = await getPublicShop(slug);
  if (!shop) return null;
  // Anyone can pick a time; booking it needs a customer profile (the last
  // step signs up or logs in without leaving the page).
  const [c, base, viewer, { t }] = await Promise.all([getShopContent(shop.id), shopBasePath(slug), getViewer(), getI18n()]);

  if (!c.profile?.booking_enabled || c.services.length === 0) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="card-shop text-neutral-600">{t.booking.unavailable}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pt-10">
      <Heading as="h1" eyebrow="BOOKING" title={t.booking.title} />
      <BookingForm
        slug={slug}
        base={base}
        viewer={viewer}
        today={todayKey(shop.timezone)}
        maxDaysAhead={c.profile.max_days_ahead}
        autoConfirm={c.profile.auto_confirm}
        services={c.services.map(({ id, name, duration_minutes, price_iqd }) => ({ id, name, duration_minutes, price_iqd }))}
        staff={c.staff.map(({ id, name, title, photo_url, is_active }) => ({ id, name, title, photo_url, is_active }))}
        staffServices={c.staffServices}
      />
    </main>
  );
}
