import { Ghost, Globe, Link2, MessageCircle, Phone, Send } from "lucide-react";
import type { SocialPlatform } from "@/lib/types";

// zhewar's brand-coloured icon boxes. lucide-react 1.x has no brand logos, so
// Facebook, Instagram, TikTok and YouTube are simple hand-drawn marks here.

type Kind = SocialPlatform | "phone";

/** Box background, card border and soft shadow per platform (zhewar SocialSection). */
export const BRAND: Record<Kind, { bg: string; fg: string; border: string; shadow: string }> = {
  instagram: { bg: "linear-gradient(135deg, #f472b6, #a855f7)", fg: "#fff", border: "#f9a8d4", shadow: "0 4px 20px rgba(244,114,182,0.18)" },
  facebook: { bg: "#1877f2", fg: "#fff", border: "#bfdbfe", shadow: "0 4px 20px rgba(24,119,242,0.15)" },
  whatsapp: { bg: "#25d366", fg: "#fff", border: "#bbf7d0", shadow: "0 4px 20px rgba(37,211,102,0.15)" },
  tiktok: { bg: "#111827", fg: "#fff", border: "#e5e7eb", shadow: "0 4px 20px rgba(0,0,0,0.08)" },
  snapchat: { bg: "#fffc00", fg: "#111827", border: "#fef08a", shadow: "0 4px 20px rgba(234,179,8,0.15)" },
  youtube: { bg: "#ff0000", fg: "#fff", border: "#fecaca", shadow: "0 4px 20px rgba(255,0,0,0.12)" },
  telegram: { bg: "#229ed9", fg: "#fff", border: "#bae6fd", shadow: "0 4px 20px rgba(34,158,217,0.15)" },
  website: { bg: "var(--shop-primary)", fg: "#fff", border: "#e5e7eb", shadow: "0 4px 20px rgba(0,0,0,0.06)" },
  other: { bg: "#404040", fg: "#fff", border: "#e5e7eb", shadow: "0 4px 20px rgba(0,0,0,0.06)" },
  phone: { bg: "var(--shop-primary)", fg: "#fff", border: "#dbeafe", shadow: "0 4px 20px rgba(37,99,235,0.12)" },
};

export function BrandIcon({ platform, className = "size-5" }: { platform: Kind; className?: string }) {
  const svg = { className, viewBox: "0 0 24 24", "aria-hidden": true } as const;
  switch (platform) {
    case "facebook":
      return (
        <svg {...svg} fill="currentColor">
          <path d="M14.2 8.2h2.6V4.4h-3c-3 0-4.6 1.9-4.6 4.8v2.1H6.8v3.8h2.4V23h4.1v-7.9h2.9l.5-3.8h-3.4V9.6c0-.9.3-1.4 1-1.4z" />
        </svg>
      );
    case "instagram":
      return (
        <svg {...svg} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.3" cy="6.7" r="0.6" fill="currentColor" />
        </svg>
      );
    case "tiktok":
      return (
        <svg {...svg} fill="currentColor">
          <path d="M16.2 2.5c.4 2.5 2 4.1 4.3 4.3v3.4c-1.6 0-3-.5-4.3-1.3v6.3a6.2 6.2 0 1 1-6.2-6.2c.3 0 .7 0 1 .1v3.5a2.8 2.8 0 1 0 1.8 2.6V2.5h3.4z" />
        </svg>
      );
    case "youtube":
      return (
        <svg {...svg}>
          <rect x="2" y="5" width="20" height="14" rx="4" fill="currentColor" />
          <path d="M10 8.8v6.4l5.4-3.2z" fill="#ff0000" />
        </svg>
      );
    case "snapchat":
      return <Ghost className={className} aria-hidden />;
    case "whatsapp":
      return <MessageCircle className={className} aria-hidden />;
    case "telegram":
      return <Send className={className} aria-hidden />;
    case "website":
      return <Globe className={className} aria-hidden />;
    case "phone":
      return <Phone className={className} aria-hidden />;
    default:
      return <Link2 className={className} aria-hidden />;
  }
}
