import Link from "next/link";
import type { Metadata } from "next";
import { CalendarPlus, Clock, ExternalLink, MapPin, MessageCircle, Phone, Scissors, Search, Sparkles } from "lucide-react";
import { getPublicShop, getShopContent, isValidSlug } from "@/lib/shop-data";
import { shopBasePath } from "@/lib/tenant";
import { displayPhone, whatsappLink } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { SOCIAL_PLATFORM } from "@/lib/labels";

// Public shop home, in the zhewar home-page style: centred hero with the logo
// in a rotating two-colour ring, red→blue divider, blue "book" + red "my
// bookings" buttons, then sections with small Latin eyebrows and big titles.

export async function generateMetadata({ params }: PageProps<"/[lang]/s/[shop]">): Promise<Metadata> {
  const { shop: slug } = await params;
  const shop = isValidSlug(slug) ? await getPublicShop(slug) : null;
  if (!shop) return {};
  const { profile } = await getShopContent(shop.id);
  return {
    title: shop.name,
    description: profile?.tagline ?? undefined,
    openGraph: { title: shop.name, description: profile?.tagline ?? undefined, images: profile?.cover_url ?? profile?.logo_url ?? undefined },
  };
}

const WEEK = [6, 0, 1, 2, 3, 4, 5]; // Saturday first
const RING =
  "conic-gradient(var(--shop-accent) 0deg, var(--shop-accent) 110deg, #f8fafc 135deg, var(--shop-primary) 160deg, var(--shop-primary) 290deg, #f8fafc 315deg, var(--shop-accent) 360deg)";

export default async function ShopHome({ params }: PageProps<"/[lang]/s/[shop]">) {
  const { shop: slug } = await params;
  const shop = await getPublicShop(slug);
  if (!shop) return null; // ShopFrame already shows not-found / closed
  const [c, base, { lang, t, f, href }] = await Promise.all([getShopContent(shop.id), shopBasePath(slug), getI18n()]);
  const s = t.shop;
  const p = c.profile;
  const primaryLocation = c.locations.find((l) => l.is_primary) ?? c.locations[0];

  return (
    <main>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden px-5 pb-16 pt-12">
        {p?.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.cover_url} alt="" className="absolute inset-0 size-full object-cover opacity-[0.07]" />
        )}
        <div className="pointer-events-none absolute -end-20 top-0 size-72 rounded-full opacity-[0.06] blur-3xl" style={{ background: "var(--shop-primary)" }} />
        <div className="pointer-events-none absolute -start-20 bottom-0 size-72 rounded-full opacity-[0.06] blur-3xl" style={{ background: "var(--shop-accent)" }} />

        <div className="relative mx-auto flex w-full max-w-xs flex-col items-center gap-4 text-center sm:max-w-sm sm:gap-5">
          {/* Logo in the rotating two-colour ring */}
          <div className="relative size-52 shrink-0 sm:size-64">
            <div className="absolute inset-0 rounded-full motion-safe:animate-ring-rotate" style={{ background: RING }} />
            <div className="absolute inset-[3px] rounded-full bg-white">
              <div className="absolute inset-[2px] grid place-items-center overflow-hidden rounded-full bg-neutral-100">
                {p?.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.logo_url} alt={shop.name} className="size-full object-cover" />
                ) : shop.kind === "salon" ? (
                  <Sparkles className="size-16" style={{ color: "var(--shop-primary)" }} aria-hidden />
                ) : (
                  <Scissors className="size-16" style={{ color: "var(--shop-primary)" }} aria-hidden />
                )}
              </div>
            </div>
          </div>

          <h1 className="font-display text-[2.5rem] font-bold leading-[1.05] tracking-tight text-neutral-900 sm:text-[3.25rem]">
            {shop.name}
          </h1>

          {/* Divider: accent → ✦ → primary */}
          <div className="flex w-full items-center justify-center gap-3">
            <div className="h-[2px] max-w-[80px] flex-1 rounded-full" style={{ background: "linear-gradient(to right, transparent, var(--shop-accent))" }} />
            <span className="text-xs text-neutral-400">✦</span>
            <div className="h-[2px] max-w-[80px] flex-1 rounded-full" style={{ background: "linear-gradient(to left, transparent, var(--shop-primary))" }} />
          </div>

          {p?.tagline && <p className="text-balance px-2 text-[0.95rem] font-medium leading-relaxed text-neutral-500">{p.tagline}</p>}

          {p?.booking_enabled && (
            <Link href={href(`${base}/book`)} className="btn-shop w-full">
              <CalendarPlus className="size-5" aria-hidden /> {s.bookNow}
            </Link>
          )}
          <p className="text-[0.7rem] tracking-wide text-neutral-400">{s.bookHint}</p>
          <Link href={href(`${base}/my-bookings`)} className="btn-shop-accent w-full">
            <Search className="size-4" aria-hidden /> {s.checkBookings}
          </Link>

          {primaryLocation?.address && (
            <p className="flex items-center gap-1.5 text-sm font-medium text-neutral-400">
              <MapPin className="size-4" aria-hidden /> {primaryLocation.address}
            </p>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-5xl space-y-20 px-5">
        {/* ── Services ── */}
        {c.services.length > 0 && (
          <Section eyebrow="SERVICES" title={s.services}>
            <ul className="grid gap-3 sm:grid-cols-2">
              {c.services.map((svc) => (
                <li key={svc.id} className="flex items-center gap-3 rounded-3xl border border-neutral-100 bg-white p-4 shadow-md-1">
                  {svc.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={svc.image_url} alt="" className="size-14 rounded-2xl object-cover" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{svc.name}</p>
                    <p className="text-sm text-neutral-500">{f.minutes(svc.duration_minutes)}</p>
                    {svc.description && <p className="mt-1 text-sm text-neutral-600">{svc.description}</p>}
                  </div>
                  {svc.price_iqd != null && <p className="shrink-0 font-bold" style={{ color: "var(--shop-primary)" }}>{f.iqd(svc.price_iqd)}</p>}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* ── Team (only when there's more than one person) ── */}
        {c.staff.length > 1 && (
          <Section eyebrow="TEAM" title={s.team}>
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {c.staff.map((m) => (
                <li key={m.id} className="text-center">
                  {m.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.photo_url} alt="" className="mx-auto aspect-square w-full max-w-36 rounded-3xl border border-neutral-100 object-cover shadow-md" />
                  ) : (
                    <div className="mx-auto grid aspect-square w-full max-w-36 place-items-center rounded-3xl bg-neutral-100 font-display text-4xl font-bold text-neutral-400">
                      {m.name.slice(0, 1)}
                    </div>
                  )}
                  <p className="mt-3 font-bold">{m.name}</p>
                  {m.title && <p className="text-sm text-neutral-500">{m.title}</p>}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* ── Gallery ── */}
        {c.gallery.length > 0 && (
          <Section eyebrow="GALLERY" title={s.gallery}>
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
              {c.gallery.map((g) => (
                <li key={g.id} className="group relative overflow-hidden rounded-3xl border border-neutral-100 shadow-md transition-shadow duration-300 hover:shadow-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g.image_url} alt={g.caption ?? ""} loading="lazy" className="aspect-[4/5] w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  {g.caption && (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                      <div className="absolute inset-x-4 bottom-4 text-start">
                        <p className="text-sm font-medium text-white">{g.caption}</p>
                        <div className="me-auto mt-1.5 h-px w-8" style={{ background: "var(--shop-primary)" }} />
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* ── Social posts ── */}
        {c.posts.length > 0 && (
          <Section eyebrow="POSTS" title={s.posts}>
            <ul className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-2 scrollbar-hide">
              {c.posts.map((post) => (
                <li key={post.id} className="w-64 shrink-0 snap-start">
                  <a href={post.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-3xl border border-neutral-100 bg-white shadow-md">
                    {post.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={post.image_url} alt="" loading="lazy" className="aspect-square w-full object-cover" />
                    )}
                    <div className="space-y-1 p-4">
                      <p className="flex items-center gap-1 text-xs text-neutral-400">
                        {SOCIAL_PLATFORM[post.platform][lang]} <ExternalLink className="size-3" aria-hidden />
                      </p>
                      {post.caption && <p className="line-clamp-3 text-sm">{post.caption}</p>}
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* ── About ── */}
        {p?.about && (
          <Section eyebrow="ABOUT" title={s.about}>
            <p className="mx-auto max-w-2xl whitespace-pre-line text-center leading-8 text-neutral-600">{p.about}</p>
          </Section>
        )}

        {/* ── Hours + contact ── */}
        <Section eyebrow="CONTACT" title={s.contact}>
          <div className="grid gap-4 md:grid-cols-2">
            {c.hours.length > 0 && (
              <div className="rounded-3xl border border-neutral-100 bg-white p-2 shadow-md-1">
                <p className="flex items-center gap-2 px-4 pb-1 pt-3 font-bold"><Clock className="size-4" aria-hidden /> {s.hours}</p>
                <ul className="divide-y divide-neutral-100">
                  {WEEK.map((d) => {
                    const h = c.hours.find((x) => x.day_of_week === d);
                    return (
                      <li key={d} className="flex justify-between px-4 py-2.5 text-sm">
                        <span>{f.day(d)}</span>
                        <span className="text-neutral-500">
                          {h?.is_open ? `${f.time(h.open_time)} – ${f.time(h.close_time)}` : s.closedDay}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div className="space-y-3 rounded-3xl border border-neutral-100 bg-white p-5 shadow-md-1">
              {p?.phone && (
                <a href={`tel:${displayPhone(p.phone)}`} className="btn-ghost w-full justify-between" dir="ltr">
                  {displayPhone(p.phone)} <Phone className="size-4" aria-hidden />
                </a>
              )}
              {p?.whatsapp && (
                <a href={whatsappLink(p.whatsapp)} target="_blank" rel="noreferrer" className="btn w-full bg-[#25d366] text-white">
                  <MessageCircle className="size-5" aria-hidden /> {t.common.whatsapp}
                </a>
              )}
              {c.links.length > 0 && (
                <ul className="flex flex-wrap gap-2 pt-1">
                  {c.links.map((l) => (
                    <li key={l.id}>
                      <a href={l.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
                        {l.title || SOCIAL_PLATFORM[l.platform][lang]}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Section>

        {/* ── Locations ── */}
        {c.locations.length > 0 && (
          <Section eyebrow="LOCATION" title={s.location}>
            <ul className="grid gap-4 md:grid-cols-2">
              {c.locations.map((loc) => (
                <li key={loc.id} className="space-y-3 rounded-3xl border border-neutral-100 bg-white p-5 shadow-md-1">
                  <p className="font-bold">{loc.name}</p>
                  {(loc.address || loc.city) && <p className="text-sm text-neutral-500">{[loc.address, loc.city].filter(Boolean).join(lang === "en" ? ", " : "، ")}</p>}
                  {loc.lat != null && loc.lng != null && (
                    <iframe
                      title={loc.name}
                      src={`https://maps.google.com/maps?q=${loc.lat},${loc.lng}&z=16&output=embed`}
                      className="h-52 w-full rounded-2xl border-0"
                      loading="lazy"
                    />
                  )}
                  {(loc.maps_url || (loc.lat != null && loc.lng != null)) && (
                    <a
                      href={loc.maps_url ?? `https://www.google.com/maps?q=${loc.lat},${loc.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-ghost w-full"
                    >
                      <MapPin className="size-4" aria-hidden /> {s.openMap}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </main>
  );
}

/** zhewar section heading: small spaced Latin eyebrow, big title, two-colour rule. */
function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-8 text-center">
        <p className="text-[0.6rem] tracking-[0.4em] text-neutral-400" dir="ltr">{eyebrow}</p>
        <h2 className="mt-2 font-display text-4xl font-bold leading-tight text-neutral-900 sm:text-5xl">{title}</h2>
        <div className="mx-auto mt-3 h-[2px] w-16 rounded-full" style={{ background: "linear-gradient(to left, var(--shop-accent), var(--shop-primary))" }} />
      </div>
      {children}
    </section>
  );
}
