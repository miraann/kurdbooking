"use client";

import { Children, useCallback, useEffect, useRef, useState } from "react";

// zhewar's gallery / social posts layout: a 3-column grid on desktop, and on
// phones a swipeable carousel (one card centred, the next ones peeking) that
// moves on by itself every 5 seconds, with dots underneath.

const CARD_VW = 78;
const GAP_VW = 4;
const STEP_VW = CARD_VW + GAP_VW;
const EDGE_VW = (100 - CARD_VW) / 2; // centres the active card

export function Carousel({ children }: { children: React.ReactNode }) {
  const cards = Children.toArray(children);
  const count = cards.length;
  const [idx, setIdx] = useState(0);
  const idxRef = useRef(0);
  const touch = useRef({ x: 0, y: 0, axis: "" as "h" | "v" | "" });

  const go = useCallback((next: number) => {
    const n = (next + count) % count;
    idxRef.current = n;
    setIdx(n);
  }, [count]);

  useEffect(() => {
    if (count < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => go(idxRef.current + 1), 5000);
    return () => clearInterval(timer);
  }, [count, go]);

  if (count === 0) return null;

  return (
    <>
      <div className="hidden gap-4 md:grid md:grid-cols-3">{cards}</div>

      <div className="-mx-5 md:hidden">
        <div
          dir="ltr"
          className="relative w-full overflow-hidden"
          onTouchStart={(e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, axis: "" }; }}
          onTouchMove={(e) => {
            if (touch.current.axis) return;
            const dx = Math.abs(e.touches[0].clientX - touch.current.x);
            const dy = Math.abs(e.touches[0].clientY - touch.current.y);
            if (dx > dy && dx > 6) touch.current.axis = "h";
            else if (dy > dx && dy > 6) touch.current.axis = "v";
          }}
          onTouchEnd={(e) => {
            if (touch.current.axis !== "h") return;
            const dx = e.changedTouches[0].clientX - touch.current.x;
            if (Math.abs(dx) > 40) go(idxRef.current + (dx < 0 ? 1 : -1));
          }}
        >
          <div
            className="flex"
            style={{
              transform: `translateX(calc(${EDGE_VW}vw - ${idx * STEP_VW}vw))`,
              transition: "transform 450ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
            }}
          >
            {cards.map((card, i) => (
              <div
                key={i}
                dir="auto"
                aria-hidden={i !== idx}
                className="relative shrink-0"
                style={{
                  width: `${CARD_VW}vw`,
                  marginRight: `${GAP_VW}vw`,
                  opacity: i === idx ? 1 : 0.4,
                  transform: i === idx ? "scale(1)" : "scale(0.97)",
                  transition: "opacity 450ms ease, transform 450ms ease",
                }}
              >
                {card}
                {i === idx && (
                  <div
                    className="pointer-events-none absolute inset-0 rounded-3xl border-2"
                    style={{ borderColor: "color-mix(in srgb, var(--shop-primary) 60%, transparent)" }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {count > 1 && (
          <div className="mt-6 flex justify-center gap-2" dir="ltr">
            {cards.map((_, i) => (
              <button key={i} type="button" onClick={() => go(i)} className="touch-manipulation p-1" aria-label={String(i + 1)} aria-current={i === idx}>
                <span
                  className={`block h-1.5 rounded-full transition-all duration-300 ${i === idx ? "w-6" : "w-1.5 bg-neutral-300"}`}
                  style={i === idx ? { background: "var(--shop-primary)" } : undefined}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
