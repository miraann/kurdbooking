"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { setFavorite } from "@/app/[lang]/favorite-actions";

/**
 * The heart on a shop page. Customers save/remove the shop at once (the
 * change is shown before the server answers and undone if it fails). Guests
 * go to /account first and come back (loginHref).
 */
export function FavoriteButton({ shopId, saved, loginHref }: { shopId: string; saved: boolean | null; loginHref: string }) {
  const { t } = useI18n();
  const s = t.shop;
  const [on, setOn] = useState(!!saved);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const label = on ? s.unfavorite : s.favorite;

  const className = `grid size-11 touch-manipulation place-items-center rounded-full border bg-white/90 shadow-md backdrop-blur transition active:scale-90 ${
    on ? "border-red-100" : "border-neutral-200"
  }`;
  const icon = <Heart className="size-5" color={on ? "#ef4444" : "#737373"} fill={on ? "#ef4444" : "none"} aria-hidden />;

  if (saved === null) {
    return (
      <a href={loginHref} className={className} aria-label={s.favorite} title={s.favoriteNeedsProfile}>
        {icon}
      </a>
    );
  }

  return (
    <span className="relative">
      <button
        type="button"
        aria-pressed={on}
        aria-label={label}
        title={label}
        disabled={pending}
        className={className}
        onClick={() => {
          const next = !on;
          setOn(next);
          setError("");
          start(async () => {
            const result = await setFavorite(shopId, next);
            if (!result.ok) {
              setOn(!next);
              setError(result.message ?? t.errors.generic);
            }
          });
        }}
      >
        {icon}
      </button>
      {error && (
        <span role="alert" className="absolute end-0 top-full mt-1 w-48 rounded-xl bg-white p-2 text-xs font-semibold text-red-600 shadow-md">
          {error}
        </span>
      )}
    </span>
  );
}
