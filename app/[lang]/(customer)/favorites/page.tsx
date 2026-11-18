import Link from "next/link";
import { connection } from "next/server";
import type { Metadata } from "next";
import { Heart } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/customer";
import { getI18n } from "@/lib/i18n/server";
import { Heading } from "@/components/shop/theme";
import { ShopCard, type ShopCardData } from "@/components/shop/ShopCard";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.favoritesPage.metaTitle, robots: { index: false } };
}

// The «دڵخواز» tab of the customer app: the shops the customer saved with the
// heart on a shop page (0013), as the same cards as the shop list. Reads the
// session, so it streams inside loading.tsx's Suspense boundary.
export default async function FavoritesPage() {
  await connection(); // the session check compares token expiry with the current time: never prerender
  const [viewer, { t, href }] = await Promise.all([getViewer(), getI18n()]);
  const p = t.favoritesPage;

  if (viewer.kind === "guest") {
    return (
      <main className="mx-auto max-w-md px-5 pt-12">
        <Heading as="h1" eyebrow="FAVOURITES" title={p.title} />
        <div className="card-shop space-y-4 py-8 text-center">
          <Heart className="mx-auto size-10" color="#ef4444" aria-hidden />
          <p className="text-neutral-600">{p.guestText}</p>
          <Link href={href("/account?next=/favorites")} className="btn-shop">{t.customerNav.signIn}</Link>
        </div>
      </main>
    );
  }

  if (viewer.kind === "staff") {
    return (
      <main className="mx-auto max-w-md px-5 pt-12">
        <div className="card-shop space-y-4 text-center">
          <p className="text-neutral-600">{t.account.staffAccount}</p>
          <Link href={href("/dashboard")} className="btn-shop">{t.account.toDashboard}</Link>
        </div>
      </main>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase.rpc("my_favorite_shops");
  const shops = ((data ?? []) as (Omit<ShopCardData, "rating_avg"> & { rating_avg: number | string | null })[]).map((s) => ({
    ...s,
    rating_avg: s.rating_avg == null ? null : Number(s.rating_avg),
  }));

  return (
    <main className="mx-auto max-w-5xl px-5 pt-12">
      <Heading as="h1" eyebrow="FAVOURITES" title={p.title}>
        <p className="mx-auto mt-4 max-w-md text-balance text-[0.95rem] font-medium leading-relaxed text-neutral-500">{p.subtitle}</p>
      </Heading>
      {shops.length === 0 ? (
        <div className="card-shop mx-auto max-w-md space-y-4 py-8 text-center">
          <Heart className="mx-auto size-10 text-neutral-300" aria-hidden />
          <div className="space-y-1">
            <p className="font-bold text-neutral-800">{p.empty}</p>
            <p className="text-sm text-neutral-500">{p.emptyHelp}</p>
          </div>
          <Link href={href("/")} className="btn-shop">{p.browse}</Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shops.map((shop) => (
            <li key={shop.id}>
              <ShopCard shop={shop} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
