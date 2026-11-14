"use client";

import { useState, useTransition } from "react";
import { Loader2, Star } from "lucide-react";
import { fill } from "@/lib/format";
import { useI18n } from "@/components/i18n/I18nProvider";
import { submitMyReview } from "./actions";

const AMBER = "#f59e0b";

/** "Rate your visit" under a completed booking: 1–5 stars and an optional comment, once. */
export function ReviewForm({ id, shopName }: { id: string; shopName: string }) {
  const { t, f } = useI18n();
  const a = t.account;
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-10 touch-manipulation items-center gap-1.5 rounded-full border border-amber-100 bg-amber-50 px-4 text-sm font-bold text-amber-700 transition active:scale-95"
      >
        <Star className="size-4" fill={AMBER} color={AMBER} aria-hidden /> {a.rate}
      </button>
    );
  }

  const shown = hover || rating;
  return (
    <form
      className="w-full space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!rating) return setError(a.errors.pickRating);
        setError("");
        start(async () => {
          const result = await submitMyReview(id, rating, body);
          if (!result.ok) setError(result.message ?? t.errors.generic);
        });
      }}
    >
      <p className="font-bold text-neutral-900">{fill(a.rateTitle, { shop: shopName })}</p>
      <div role="radiogroup" aria-label={fill(a.rateTitle, { shop: shopName })} className="flex gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={fill(a.stars, { n: f.num(n) })}
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            className="grid size-11 touch-manipulation place-items-center rounded-xl transition active:scale-90"
          >
            <Star className="size-8" color={n <= shown ? AMBER : "#d4d4d8"} fill={n <= shown ? AMBER : "none"} aria-hidden />
          </button>
        ))}
      </div>
      <label className="block">
        <span className="sr-only">{a.comment}</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder={a.comment}
          className="input-shop h-auto py-3"
        />
      </label>
      {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn-shop w-auto flex-1 py-3 disabled:opacity-60">
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />} {a.sendReview}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-2xl border border-neutral-200 px-5 text-sm font-semibold text-neutral-600">
          {t.common.close}
        </button>
      </div>
      <p className="text-xs text-neutral-400">{a.reviewNote}</p>
    </form>
  );
}
