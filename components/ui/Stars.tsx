import { Star } from "lucide-react";

/** 1–5 stars, filled up to `rating` (rounded). Decorative: pair it with a number for screen readers. */
export function Stars({ rating, className = "size-4", color = "#f59e0b" }: { rating: number; className?: string; color?: string }) {
  const full = Math.round(rating);
  return (
    <span className="inline-flex gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={className} style={{ color: n <= full ? color : "#d4d4d8" }} fill={n <= full ? color : "none"} />
      ))}
    </span>
  );
}
