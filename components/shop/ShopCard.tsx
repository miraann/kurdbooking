import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { ListedShop } from "@/lib/shop-data";
import { getI18n } from "@/lib/i18n/server";
import { Stars } from "@/components/ui/Stars";
import { LogoRing } from "@/components/shop/theme";

/** What a shop card needs. Saved shops (my_favorite_shops) come without a cover. */
export type ShopCardData = Omit<ListedShop, "cover_url"> & { cover_url?: string | null };

type Kind = "barber" | "salon";

/** A shop in a list (the home page, the favourites tab): cover, logo ring, name, type, rating. Opens /s/<slug>. */
export async function ShopCard({ shop }: { shop: ShopCardData }) {
  const { t, f, href } = await getI18n();
  const s = t.shops;
  const kinds: Kind[] = shop.kind === "both" ? ["barber", "salon"] : [shop.kind];
  return (
    <Link
      href={href(`/s/${shop.slug}`)}
      className="group flex h-full flex-col overflow-hidden rounded-3xl border border-neutral-100 bg-white shadow-md transition-shadow duration-300 hover:shadow-xl"
    >
      {/* Cover (or a soft red→blue wash) */}
      <div className="relative h-28 overflow-hidden bg-neutral-50">
        {shop.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shop.cover_url} alt="" loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="size-full opacity-15" style={{ background: "linear-gradient(to left, var(--shop-accent), var(--shop-primary))" }} />
        )}
      </div>

      <div className="-mt-12 flex flex-1 flex-col items-center gap-2 px-5 pb-5 text-center">
        <LogoRing logoUrl={shop.logo_url} kind={shop.kind} className="size-24" iconClassName="size-9" spin={false} />
        <h2 className="mt-1 font-display text-xl font-bold leading-tight text-neutral-900">{shop.name}</h2>

        <div className="flex flex-wrap justify-center gap-1.5">
          {kinds.map((k) => (
            <span
              key={k}
              className="rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold"
              style={{
                color: k === "salon" ? "var(--shop-accent)" : "var(--shop-primary)",
                background: `color-mix(in srgb, ${k === "salon" ? "var(--shop-accent)" : "var(--shop-primary)"} 10%, white)`,
              }}
            >
              {s[k]}
            </span>
          ))}
        </div>

        {shop.tagline && <p className="line-clamp-2 text-sm text-neutral-500">{shop.tagline}</p>}

        <div className="mt-auto flex w-full items-center justify-between gap-2 pt-3">
          {shop.rating_avg != null && shop.rating_count > 0 ? (
            <span className="flex items-center gap-1.5 text-xs text-neutral-500">
              <Stars rating={shop.rating_avg} className="size-3.5" />
              <span className="font-bold text-neutral-900">{f.num(shop.rating_avg.toFixed(1))}</span>
              <span>({f.num(shop.rating_count)})</span>
            </span>
          ) : (
            <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[0.7rem] font-semibold text-neutral-500">{s.isNew}</span>
          )}
          <span className="flex items-center gap-0.5 text-sm font-bold" style={{ color: "var(--shop-primary)" }}>
            {s.view} <ChevronLeft className="size-4 ltr:rotate-180" aria-hidden />
          </span>
        </div>
      </div>
    </Link>
  );
}
