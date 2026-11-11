import Link from "next/link";
import type { Metadata } from "next";
import { CalendarPlus, ExternalLink, MapPin, Search, Share2 } from "lucide-react";
import { getPublicShop, getShopContent, getShopReviews, isValidSlug } from "@/lib/shop-data";
import { shopBasePath } from "@/lib/tenant";
import { displayPhone, fill, whatsappLink } from "@/lib/format";
import type { SocialPlatform } from "@/lib/types";
import { getI18n } from "@/lib/i18n/server";
import { SOCIAL_PLATFORM } from "@/lib/labels";
import { Stars } from "@/components/ui/Stars";
import { Divider, Heading, LogoRing } from "@/components/shop/theme";
import { Carousel } from "@/components/shop/Carousel";
import { BRAND, BrandIcon } from "@/components/shop/BrandIcon";

// Public shop home, in the zhewar home-page style: centred hero with the logo
// in a rotating two-colour ring, red→blue divider, blue "book" + red "my
// bookings" buttons, then sections with small Latin eyebrows and big titles.
// Gallery and social posts are zhewar's carousel (phones) / grid (desktop);
// the page ends with zhewar's «تۆڕی کۆمەڵایەتی» cards and the book button.

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

/** "https://www.instagram.com/x/" → "instagram.com/x" */
const shortUrl = (url: string) => url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

export default async function ShopHome({ params }: PageProps<"/[lang]/s/[shop]">) {
  const { shop: slug } = await params;
  const shop = await getPublicShop(slug);
  if (!shop) return null; // ShopFrame already shows not-found / closed
  const [c, reviews, base, { lang, t, f, href }] = await Promise.all([
    getShopContent(shop.id), getShopReviews(shop.id), shopBasePath(slug), getI18n(),
  ]);
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
          <LogoRing logoUrl={p?.logo_url} kind={shop.kind} alt={shop.name} />

          <h1 className="font-display text-[2.5rem] font-bold leading-[1.05] tracking-tight text-neutral-900 sm:text-[3.25rem]">
            {shop.name}
          </h1>

          <Divider />

          {p?.tagline && <p className="text-balance px-2 text-[0.95rem] font-medium leading-relaxed text-neutral-500">{p.tagline}</p>}

          {reviews.avg != null && (
            <a href="#reviews" className="flex items-center gap-2 text-sm text-neutral-500">
              <Stars rating={reviews.avg} />
              <span className="font-bold text-neutral-900">{f.num(reviews.avg.toFixed(1))}</span>
              <span>({fill(s.reviewsCount, { n: f.num(reviews.count) })})</span>
            </a>
          )}

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

        {/* ── Gallery (zhewar: carousel on phones, grid on desktop) ── */}
        {c.gallery.length > 0 && (
          <Section eyebrow="GALLERY" title={s.gallery}>
            <Carousel>
              {c.gallery.map((g) => (
                <div key={g.id} className="group relative aspect-[3/4] overflow-hidden rounded-3xl border border-neutral-100 shadow-md transition-shadow duration-300 hover:shadow-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g.image_url} alt={g.caption ?? ""} loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                  {g.caption && <CardCaption text={g.caption} />}
                </div>
              ))}
            </Carousel>
          </Section>
        )}

        {/* ── Social media posts (same carousel) ── */}
        {c.posts.length > 0 && (
          <Section eyebrow="POSTS" title={s.posts}>
            <Carousel>
              {c.posts.map((post) => (
                <a
                  key={post.id}
                  href={post.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group relative block aspect-[3/4] touch-manipulation overflow-hidden rounded-3xl border border-neutral-100 bg-neutral-100 shadow-md transition-shadow duration-300 hover:shadow-xl"
                >
                  {post.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={post.image_url} alt="" loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="grid size-full place-items-center"><Share2 className="size-14 text-neutral-300" aria-hidden /></div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                  <span
                    className="absolute start-4 top-4 flex items-center gap-1.5 rounded-full py-1 pe-3 ps-1 text-xs font-bold shadow-md"
                    style={{ background: "rgb(255 255 255 / 0.92)", color: "#171717" }}
                  >
                    <span className="grid size-6 place-items-center rounded-full" style={{ background: BRAND[post.platform].bg, color: BRAND[post.platform].fg }}>
                      <BrandIcon platform={post.platform} className="size-3.5" />
                    </span>
                    {SOCIAL_PLATFORM[post.platform][lang]}
                    <ExternalLink className="size-3 text-neutral-400" aria-hidden />
                  </span>
                  {post.caption && <CardCaption text={post.caption} />}
                </a>
              ))}
            </Carousel>
          </Section>
        )}

        {/* ── Reviews (written in the customer app after a completed visit) ── */}
        {reviews.latest.length > 0 && (
          <div id="reviews" className="scroll-mt-20">
            <Section eyebrow="REVIEWS" title={s.reviews}>
              {reviews.avg != null && (
                <p className="-mt-4 mb-6 flex items-center justify-center gap-2 text-sm text-neutral-500">
                  <Stars rating={reviews.avg} className="size-5" />
                  <span className="text-lg font-bold text-neutral-900">{f.num(reviews.avg.toFixed(1))}</span>
                  <span>({fill(s.reviewsCount, { n: f.num(reviews.count) })})</span>
                </p>
              )}
              <ul className="grid gap-3 sm:grid-cols-2">
                {reviews.latest.map((r) => (
                  <li key={r.id} className="space-y-2 card-shop">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold">{r.reviewer_name || "—"}</span>
                      <Stars rating={r.rating} />
                    </div>
                    <span className="sr-only">{f.num(r.rating)} / {f.num(5)}</span>
                    {r.body && <p className="whitespace-pre-line text-sm leading-7 text-neutral-600">{r.body}</p>}
                    <p className="text-xs text-neutral-400">{f.shortDate(r.created_at, shop.timezone)}</p>
                    {r.reply && (
                      <div className="rounded-2xl bg-neutral-50 p-3 text-sm">
                        <p className="mb-1 text-xs font-semibold" style={{ color: "var(--shop-primary)" }}>{s.shopReply}</p>
                        <p className="whitespace-pre-line text-neutral-600">{r.reply}</p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          </div>
        )}

        {/* ── About ── */}
        {p?.about && (
          <Section eyebrow="ABOUT" title={s.about}>
            <p className="mx-auto max-w-2xl whitespace-pre-line text-center leading-8 text-neutral-600">{p.about}</p>
          </Section>
        )}

        {/* ── Social networks (zhewar: brand cards, location card, book button) ── */}
        {(c.links.length > 0 || p?.whatsapp || p?.phone || c.locations.length > 0 || p?.booking_enabled) && (
          <Section eyebrow="SOCIAL" title={s.socials}>
            <div className="mx-auto w-full max-w-sm space-y-3">
              {c.links.map((l) => (
                <BrandCard
                  key={l.id}
                  platform={l.platform}
                  href={l.url}
                  label={l.title || SOCIAL_PLATFORM[l.platform][lang]}
                  sub={shortUrl(l.url)}
                />
              ))}
              {p?.whatsapp && !c.links.some((l) => l.platform === "whatsapp") && (
                <BrandCard platform="whatsapp" href={whatsappLink(p.whatsapp)} label={t.common.whatsapp} sub={displayPhone(p.whatsapp)} />
              )}
              {p?.phone && (
                <BrandCard platform="phone" href={`tel:${displayPhone(p.phone)}`} label={s.phone} sub={displayPhone(p.phone)} />
              )}

              {/* Location: the big red card */}
              {c.locations.map((loc) => {
                const map = loc.maps_url ?? (loc.lat != null && loc.lng != null ? `https://www.google.com/maps?q=${loc.lat},${loc.lng}` : null);
                const where = [loc.address, loc.city].filter(Boolean).join(lang === "en" ? ", " : "، ");
                const body = (
                  <>
                    <div className="grid size-20 place-items-center rounded-2xl" style={{ background: "var(--shop-accent)" }}>
                      <MapPin className="size-10 text-white" aria-hidden />
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-neutral-900">{c.locations.length > 1 ? loc.name : s.ourLocation}</p>
                      {where && <p className="mt-1 text-sm text-neutral-500">{where}</p>}
                      {map && <p className="mt-1 text-xs text-neutral-400">{s.mapHint}</p>}
                    </div>
                  </>
                );
                const cls = "flex w-full flex-col items-center gap-3 rounded-2xl border bg-white p-6 transition-all duration-200";
                const style = { borderColor: "color-mix(in srgb, var(--shop-accent) 30%, white)", boxShadow: "0 4px 20px rgba(239,68,68,0.15)" };
                return map ? (
                  <a key={loc.id} href={map} target="_blank" rel="noreferrer" className={`${cls} touch-manipulation active:scale-[0.98]`} style={style}>{body}</a>
                ) : (
                  <div key={loc.id} className={cls} style={style}>{body}</div>
                );
              })}

              {p?.booking_enabled && (
                <div className="pt-4">
                  <div className="mb-4 h-px bg-gradient-to-r from-transparent via-neutral-200 to-transparent" />
                  <Link href={href(`${base}/book`)} className="btn-shop w-full py-5">
                    <CalendarPlus className="size-5" aria-hidden /> {s.bookNow}
                  </Link>
                </div>
              )}
            </div>
          </Section>
        )}
      </div>
    </main>
  );
}

/** zhewar card caption: white text over the dark fade, short blue line under it. */
function CardCaption({ text }: { text: string }) {
  return (
    <div className="absolute inset-x-4 bottom-4 text-start">
      <p className="text-sm font-medium text-white">{text}</p>
      <div className="me-auto mt-1.5 h-px w-8" style={{ background: "var(--shop-primary)" }} />
    </div>
  );
}

/** zhewar social card: brand-coloured icon box, name, short link. */
function BrandCard({ platform, href, label, sub }: { platform: SocialPlatform | "phone"; href: string; label: string; sub: string }) {
  const b = BRAND[platform];
  const external = !href.startsWith("tel:");
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      className="flex touch-manipulation items-center gap-4 rounded-2xl border bg-white p-4 transition-all duration-200 active:scale-[0.98]"
      style={{ borderColor: b.border, boxShadow: b.shadow }}
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-xl" style={{ background: b.bg, color: b.fg }}>
        <BrandIcon platform={platform} />
      </span>
      <span className="min-w-0 flex-1 text-start">
        <span className="block text-base font-bold text-neutral-900">{label}</span>
        <span className="mt-0.5 block truncate text-xs text-neutral-400"><bdi dir="ltr">{sub}</bdi></span>
      </span>
      {external && <ExternalLink className="size-4 shrink-0 text-neutral-300" aria-hidden />}
    </a>
  );
}

/** zhewar section: heading with the Latin eyebrow, then the content. */
function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section>
      <Heading eyebrow={eyebrow} title={title} />
      {children}
    </section>
  );
}
