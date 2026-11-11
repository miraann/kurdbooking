import { Scissors, Sparkles } from "lucide-react";
import type { ShopKind } from "@/lib/types";

// zhewar's customer-side look, shared by the shops list and every shop page.
// The colours are --shop-accent (red) and --shop-primary (blue); outside a
// shop page they fall back to zhewar's red and blue in globals.css.

/** Two-colour conic ring: red arc, white gap, blue arc, white gap. */
export const RING =
  "conic-gradient(var(--shop-accent) 0deg, var(--shop-accent) 110deg, #f8fafc 135deg, var(--shop-primary) 160deg, var(--shop-primary) 290deg, #f8fafc 315deg, var(--shop-accent) 360deg)";

/** Barber pole for barbershops; a plain two-colour strip for women's salons. */
export function ShopStrip({ kind, className = "h-2.5" }: { kind?: ShopKind; className?: string }) {
  return kind === "salon" ? (
    <div className={`w-full ${className}`} style={{ background: "linear-gradient(to left, var(--shop-accent), var(--shop-primary))" }} />
  ) : (
    <div className={`barber-pole w-full motion-safe:animate-pole-slide ${className}`} />
  );
}

/** zhewar's page background: neutral-50 with faint drifting red/blue stripes. */
export function StripeBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-neutral-50">
      <div className="stripe-bg absolute inset-0" />
    </div>
  );
}

/** A logo (or the scissors / sparkle mark) inside the rotating two-colour ring. */
export function LogoRing({
  logoUrl, kind, alt = "", className = "size-52 sm:size-64", iconClassName = "size-16", spin = true,
}: {
  logoUrl?: string | null; kind?: ShopKind; alt?: string; className?: string; iconClassName?: string; spin?: boolean;
}) {
  const Icon = kind === "salon" ? Sparkles : Scissors;
  return (
    <div className={`relative shrink-0 ${className}`}>
      <div className={`absolute inset-0 rounded-full ${spin ? "motion-safe:animate-ring-rotate" : ""}`} style={{ background: RING }} />
      <div className="absolute inset-[3px] rounded-full bg-white">
        <div className="absolute inset-[2px] grid place-items-center overflow-hidden rounded-full bg-neutral-100">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={alt} className="size-full object-cover" />
          ) : (
            <Icon className={iconClassName} style={{ color: "var(--shop-primary)" }} aria-hidden />
          )}
        </div>
      </div>
    </div>
  );
}

/** accent → ✦ → primary */
export function Divider() {
  return (
    <div className="flex w-full items-center justify-center gap-3">
      <div className="h-[2px] max-w-[80px] flex-1 rounded-full" style={{ background: "linear-gradient(to right, transparent, var(--shop-accent))" }} />
      <span className="text-xs text-neutral-400">✦</span>
      <div className="h-[2px] max-w-[80px] flex-1 rounded-full" style={{ background: "linear-gradient(to left, transparent, var(--shop-primary))" }} />
    </div>
  );
}

/** Page heading: small spaced Latin eyebrow, big title, two-colour rule. */
export function Heading({ eyebrow, title, as: Tag = "h2", children }: {
  eyebrow: string; title: string; as?: "h1" | "h2"; children?: React.ReactNode;
}) {
  return (
    <div className="mb-8 text-center">
      <p className="text-[0.6rem] tracking-[0.4em] text-neutral-400" dir="ltr">{eyebrow}</p>
      <Tag className="mt-2 font-display text-4xl font-bold leading-tight text-neutral-900 sm:text-5xl">{title}</Tag>
      <div className="mx-auto mt-3 h-[2px] w-16 rounded-full" style={{ background: "linear-gradient(to left, var(--shop-accent), var(--shop-primary))" }} />
      {children}
    </div>
  );
}
