"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MapPin as PinIcon, Navigation, X } from "lucide-react";
import type { Map as MapLibreMap, Marker, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./map.css";
import style from "./style.json";
import { MAP_AREA } from "@/lib/map-area";
import type { MapPin } from "@/lib/types";
import { useI18n } from "@/components/i18n/I18nProvider";
import { LogoRing } from "@/components/shop/theme";
import { Stars } from "@/components/ui/Stars";

// The customer app's map: Sulaymaniyah city only (lib/map-area.ts: the view can't leave it), and
// only KurdBooking's own shops on it: every listed shop's branch is a pin (its logo in the
// two-colour ring); tapping one opens a card with «view & book» and «directions».
//
// The base map is OpenFreeMap's «Positron» street map (vector tiles, free, no key) in ./style.json,
// with its business layers and every icon removed (lib/map-style.test.mjs checks it): streets,
// buildings, parks, water and names, and no cafes, hotels, gyms or other places. Kurdish and Arabic
// names need MapLibre's right-to-left text plugin, served from /vendor (public/vendor).
// Hosts used: tiles.openfreemap.org (next.config.ts lists them in the CSP).

const RTL_PLUGIN = "/vendor/mapbox-gl-rtl-text.js";

// MapLibre draws 512px tiles: the world is 512 · 2^zoom pixels wide.
const mercatorY = (lat: number) => 0.5 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / (2 * Math.PI);

/** The smallest zoom at which the city's box still covers the whole screen (nothing outside it is ever visible). */
function coverZoom(width: number, height: number): number {
  const b = MAP_AREA.bounds;
  const dx = (b.east - b.west) / 360;
  const dy = mercatorY(b.south) - mercatorY(b.north);
  const z = Math.max(Math.log2(width / (512 * dx)), Math.log2(height / (512 * dy)));
  return Math.min(Math.max(z, MAP_AREA.minZoom), MAP_AREA.maxZoom - 1);
}

const el = (cls: string) => {
  const d = document.createElement("div");
  d.className = cls;
  return d;
};

/** One pin: the shop's logo (or its first letter) in the ring, with a tail. Built without innerHTML: names and logo addresses are owner input. */
function pinElement(pin: MapPin, onChoose: () => void): HTMLElement {
  const wrap = el("kb-pin-wrap"); // MapLibre positions this one…
  wrap.setAttribute("role", "button");
  wrap.tabIndex = 0;
  wrap.setAttribute("aria-label", pin.name);
  const inner = el("kb-pin"); // …so the look and the «chosen» size live on this one
  const face = el("kb-pin-face");
  if (pin.logoUrl) {
    const img = document.createElement("img");
    img.src = pin.logoUrl;
    img.alt = "";
    img.draggable = false;
    face.append(img);
  } else {
    face.textContent = Array.from(pin.name.trim())[0]?.toUpperCase() ?? "•";
  }
  const ring = el("kb-pin-ring");
  ring.append(face);
  inner.append(ring, el("kb-pin-tail"));
  wrap.append(inner);
  // stopPropagation: a tap on a pin must not count as a tap on the empty map (which closes the card).
  wrap.addEventListener("click", (e) => {
    e.stopPropagation();
    onChoose();
  });
  wrap.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onChoose();
    }
  });
  return wrap;
}

export function ShopMap({ pins }: { pins: MapPin[] }) {
  const { t, f, href } = useI18n();
  const box = useRef<HTMLDivElement>(null);
  const markers = useRef(new Map<string, Marker>());
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Draw the map once. MapLibre needs the window and WebGL, so it is loaded here, not at import time.
  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | undefined;
    const drawn = markers.current;
    (async () => {
      try {
        const mod = await import("maplibre-gl");
        const ml = (mod as unknown as { default?: typeof mod }).default ?? mod;
        if (cancelled || !box.current) return;
        if (ml.getRTLTextPluginStatus() === "unavailable") {
          ml.setRTLTextPlugin(`${window.location.origin}${RTL_PLUGIN}`, true).catch(() => {}); // only fetched when Kurdish/Arabic names are drawn
        }

        const b = MAP_AREA.bounds;
        const m = new ml.Map({
          container: box.current,
          style: style as unknown as StyleSpecification,
          center: [MAP_AREA.center.lng, MAP_AREA.center.lat],
          zoom: MAP_AREA.zoom,
          minZoom: MAP_AREA.minZoom,
          maxZoom: MAP_AREA.maxZoom,
          // Sulaymaniyah only: the view can't leave the city's box…
          maxBounds: [[b.west, b.south], [b.east, b.north]],
          renderWorldCopies: false,
          // …and the map stays flat: no rotating or tilting by accident.
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          attributionControl: false,
        });
        map = m;
        m.touchZoomRotate.disableRotation();
        m.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
        // At the top: the tab bar floats over the bottom of the map. OpenFreeMap and OpenStreetMap ask for it.
        m.addControl(new ml.AttributionControl({ compact: false }), "top-left");

        // …and can't zoom out to where the box no longer fills the screen (a tall phone shows less of the city
        // than a wide tablet). Worked out again when the screen turns or resizes.
        const fitMinZoom = () => {
          const c = m.getContainer();
          m.setMinZoom(coverZoom(c.clientWidth, c.clientHeight));
        };
        fitMinZoom();
        m.on("resize", fitMinZoom);

        for (const pin of pins) {
          const marker = new ml.Marker({ element: pinElement(pin, () => setSelectedId(pin.locationId)), anchor: "bottom" })
            .setLngLat([pin.lng, pin.lat])
            .addTo(m);
          drawn.set(pin.locationId, marker);
        }
        m.on("click", () => setSelectedId(null));

        if (pins.length > 0) {
          const bounds = new ml.LngLatBounds();
          for (const p of pins) bounds.extend([p.lng, p.lat]);
          m.fitBounds(bounds, { padding: 70, maxZoom: 16, duration: 0 });
        }
        m.once("load", () => setReady(true));
      } catch {
        // No WebGL (a very old or restricted WebView): say so instead of leaving a blank screen.
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      map?.remove();
      drawn.clear();
    };
  }, [pins]);

  // The chosen pin grows and comes to the front.
  useEffect(() => {
    for (const [id, marker] of markers.current) {
      const on = id === selectedId;
      const wrap = marker.getElement();
      wrap.firstElementChild?.classList.toggle("kb-pin-selected", on);
      wrap.style.zIndex = on ? "10" : "";
    }
  }, [selectedId, ready]);

  const pin = pins.find((p) => p.locationId === selectedId) ?? null;
  const kinds = pin ? (pin.kind === "both" ? (["barber", "salon"] as const) : ([pin.kind] as const)) : [];
  const where = pin ? [pin.locationName, pin.address, pin.city].filter(Boolean).join(" · ") : "";

  return (
    // isolate: the map's own z-indexes stay inside it, under the header and the tab bar.
    <div className="kb-map relative isolate size-full overflow-hidden bg-neutral-100">
      {/* MapLibre's own stylesheet makes its container position:relative (and unlayered CSS beats
          Tailwind's), so the map can't be the absolutely placed element itself: it fills this one. */}
      <div className="absolute inset-0">
        <div ref={box} dir="ltr" role="application" aria-label={t.mapPage.label} className="size-full" />
      </div>

      {!ready && !failed && <div className="absolute inset-0 z-[1100] animate-pulse bg-neutral-100" aria-hidden />}

      {failed && (
        <p className="absolute inset-x-4 top-1/3 z-[1100] mx-auto max-w-sm rounded-2xl bg-white px-4 py-3 text-center text-sm font-medium text-neutral-600 shadow-lg">
          {t.mapPage.failed}
        </p>
      )}

      {ready && pins.length === 0 && (
        // At the bottom, above the tab bar: the top corners hold the zoom buttons and the attribution.
        <p
          className="absolute inset-x-4 z-[1100] mx-auto max-w-sm rounded-2xl bg-white/95 px-4 py-3 text-center text-sm font-medium text-neutral-600 shadow-lg md:bottom-4"
          style={{ bottom: "calc(5.75rem + env(safe-area-inset-bottom, 0px))" }}
        >
          {t.mapPage.empty}
        </p>
      )}

      {pin && (
        <div
          className="absolute inset-x-3 z-[1100] mx-auto max-w-md md:bottom-4"
          style={{ bottom: "calc(5.75rem + env(safe-area-inset-bottom, 0px))" }}
        >
          <div className="relative space-y-3 rounded-3xl border border-neutral-100 bg-white p-4 shadow-xl">
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              aria-label={t.mapPage.close}
              className="absolute end-3 top-3 grid size-8 place-items-center rounded-full text-neutral-400 transition active:scale-90 active:bg-neutral-100"
            >
              <X className="size-4" aria-hidden />
            </button>
            <div className="flex items-center gap-3 pe-8">
              <LogoRing logoUrl={pin.logoUrl} kind={pin.kind} className="size-14" iconClassName="size-6" spin={false} />
              <div className="min-w-0 space-y-1">
                <p className="truncate font-display text-lg font-bold leading-tight text-neutral-900">{pin.name}</p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {kinds.map((k) => (
                    <span
                      key={k}
                      className="rounded-full px-2 py-0.5 text-[0.68rem] font-semibold"
                      style={{
                        color: k === "salon" ? "var(--shop-accent)" : "var(--shop-primary)",
                        background: `color-mix(in srgb, ${k === "salon" ? "var(--shop-accent)" : "var(--shop-primary)"} 10%, white)`,
                      }}
                    >
                      {t.shops[k]}
                    </span>
                  ))}
                  {pin.rating != null && pin.ratingCount > 0 && (
                    <span className="flex items-center gap-1 text-xs text-neutral-500">
                      <Stars rating={pin.rating} className="size-3" />
                      <span className="font-bold text-neutral-900">{f.num(pin.rating.toFixed(1))}</span>
                      <span>({f.num(pin.ratingCount)})</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
            {where && (
              <p className="flex items-start gap-1.5 text-sm text-neutral-500">
                <PinIcon className="mt-0.5 size-4 shrink-0 text-neutral-400" aria-hidden />
                <span>{where}</span>
              </p>
            )}
            <div className="flex gap-2">
              <Link href={href(`/s/${pin.slug}`)} className="btn-shop flex-1 !py-3 text-sm">
                {t.shops.view}
              </Link>
              {/* Opens Google Maps (outside the app: only the site's own hosts stay inside it). */}
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${pin.lat},${pin.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-bold text-neutral-700 transition active:scale-95"
              >
                <Navigation className="size-4" style={{ color: "var(--shop-primary)" }} aria-hidden />
                {t.mapPage.directions}
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
