import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import Form from "next/form";
import type { Metadata } from "next";
import { Heart, Search } from "lucide-react";
import { getListedShops, type ListedShop } from "@/lib/shop-data";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/customer";
import { fill } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { Divider, Heading, LogoRing } from "@/components/shop/theme";
import { ShopCard } from "@/components/shop/ShopCard";

// The site's home page (/): every live shop that chose to be listed, with a type filter
// and a name search. Browsing needs no account. Each card opens /s/<slug>.

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.shops.metaTitle, description: t.shops.subtitle };
}

type Kind = "barber" | "salon";
const KINDS: (Kind | null)[] = [null, "barber", "salon"];

export default async function HomePage({ searchParams }: PageProps<"/[lang]">) {
  const sp = await searchParams;
  const kind: Kind | null = sp.kind === "barber" || sp.kind === "salon" ? sp.kind : null;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 60) : "";
  const [shops, { t, f, href }] = await Promise.all([getListedShops(kind, q), getI18n()]);
  const s = t.shops;

  const listUrl = (k: Kind | null) => {
    const params = new URLSearchParams();
    if (k) params.set("kind", k);
    if (q) params.set("q", q);
    const qs = params.toString();
    return qs ? `${href("/")}?${qs}` : href("/"); // "/ar?kind=…", not "/ar/?kind=…"
  };

  return (
    <main className="relative overflow-hidden">
      <div className="pointer-events-none absolute -end-24 top-0 size-80 rounded-full opacity-[0.06] blur-3xl" style={{ background: "var(--shop-primary)" }} />
      <div className="pointer-events-none absolute -start-24 top-40 size-80 rounded-full opacity-[0.06] blur-3xl" style={{ background: "var(--shop-accent)" }} />

      <div className="relative mx-auto max-w-5xl px-5 pt-12">
        <Heading as="h1" eyebrow="SHOPS" title={s.title}>
          <p className="mx-auto mt-4 max-w-md text-balance text-[0.95rem] font-medium leading-relaxed text-neutral-500">{s.subtitle}</p>
        </Heading>

        {/* A logged-in customer's saved shops first (reads the session). */}
        <Suspense fallback={null}>
          <FavoriteStrip />
        </Suspense>

        {/* Search (keeps the chosen type) */}
        <Form action={href("/")} className="mx-auto flex max-w-xl gap-2">
          {kind && <input type="hidden" name="kind" value={kind} />}
          <label className="relative flex-1">
            <span className="sr-only">{s.search}</span>
            <Search className="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-neutral-400" aria-hidden />
            <input name="q" type="search" defaultValue={q} placeholder={s.search} maxLength={60} className="input-shop ps-11" />
          </label>
          <button type="submit" className="btn-shop w-auto shrink-0 px-6">{s.searchButton}</button>
        </Form>

        {/* Type filter */}
        <nav className="mx-auto mt-4 flex max-w-xl justify-center gap-2" aria-label={s.metaTitle}>
          {KINDS.map((k) => {
            const on = k === kind;
            return (
              <Link
                key={k ?? "all"}
                href={listUrl(k)}
                aria-current={on ? "page" : undefined}
                className={`rounded-full px-4 py-2 text-sm font-bold transition active:scale-95 ${
                  on ? "text-white shadow-md" : "border border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300"
                }`}
                style={on ? { background: "var(--shop-primary)" } : undefined}
              >
                {k === null ? s.all : s[k]}
              </Link>
            );
          })}
        </nav>

        <div className="mt-10">
          <Divider />
        </div>

        {shops.length === 0 ? (
          <div className="card-shop mx-auto mt-8 max-w-md space-y-4 text-center">
            <p className="text-neutral-500">{s.none}</p>
            {(kind || q) && <Link href={href("/")} className="btn-shop-accent">{s.showAll}</Link>}
          </div>
        ) : (
          <>
            <p className="mb-4 mt-6 text-center text-xs text-neutral-400">{fill(s.count, { n: f.num(shops.length) })}</p>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shops.map((shop) => (
                <li key={shop.id}>
                  <ShopCard shop={shop} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}

/** Saved shops as small logo chips above the search; nothing for guests or when none are saved. */
async function FavoriteStrip() {
  await connection(); // the session check compares token expiry with the current time
  const viewer = await getViewer();
  if (viewer.kind !== "customer") return null;
  const supabase = await createClient();
  const [{ data }, { t, href }] = await Promise.all([supabase.rpc("my_favorite_shops"), getI18n()]);
  const shops = (data ?? []) as Pick<ListedShop, "id" | "slug" | "name" | "kind" | "logo_url">[];
  if (shops.length === 0) return null;
  return (
    <section className="mx-auto mb-6 max-w-xl" aria-label={t.account.favorites}>
      <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-neutral-700">
        <Heart className="size-4" color="#ef4444" fill="#ef4444" aria-hidden /> {t.account.favorites}
      </h2>
      <ul className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1 scrollbar-hide">
        {shops.map((s) => (
          <li key={s.id} className="shrink-0">
            <Link href={href(`/s/${s.slug}`)} className="flex w-20 flex-col items-center gap-1.5 text-center">
              <LogoRing logoUrl={s.logo_url} kind={s.kind} className="size-16" iconClassName="size-6" spin={false} />
              <span className="line-clamp-2 text-xs font-bold leading-tight text-neutral-800">{s.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
