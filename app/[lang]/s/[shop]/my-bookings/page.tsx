import type { Metadata } from "next";
import { shopBasePath } from "@/lib/tenant";
import { getI18n } from "@/lib/i18n/server";
import { MyBookings } from "./MyBookings";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.shop.myBookings, robots: { index: false } };
}

export default async function MyBookingsPage({ params }: PageProps<"/[lang]/s/[shop]/my-bookings">) {
  const { shop: slug } = await params;
  const [base, { t }] = await Promise.all([shopBasePath(slug), getI18n()]);
  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold" style={{ color: "var(--shop-primary)" }}>{t.shop.myBookings}</h1>
      <MyBookings slug={slug} base={base} />
    </main>
  );
}
