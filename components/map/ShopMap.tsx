"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MapPin as PinIcon, Navigation, X } from "lucide-react";
import type { Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import "./map.css";
import { MAP_AREA } from "@/lib/map-area";
import type { MapPin } from "@/lib/types";
import { useI18n } from "@/components/i18n/I18nProvider";
import { LogoRing } from "@/components/shop/theme";
import { Stars } from "@/components/ui/Stars";

// The customer app's map: Sulaymaniyah city only (lib/map-area.ts: the view can't leave it), every listed
// shop's branch as a pin (its logo in the two-colour ring), a card with «view &
// book» and «directions» when a pin is tapped. Leaflet + OpenStreetMap tiles: no
// account or key. The tile address is the one place to change if OpenStreetMap's
// usage limits are ever outgrown; its host is listed in the CSP (next.config.ts).

const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ESCAPES[c]);

/** The pin's HTML. Shop names and logo addresses are owner input: always escaped. */
function pinHtml(p: MapPin, selected: boolean): string {
  const face = p.logoUrl ? `<img src="${esc(p.logoUrl)}" alt="" draggable="false">` : esc(Array.from(p.name.trim())[0]?.toUpperCase() ?? "•");
  return `<div class="kb-pin${selected ? " kb-pin-selected" : ""}"><div class="kb-pin-ring"><div class="kb-pin-face">${face}</div></div><div class="kb-pin-tail"></div></div>`;
}

const PIN_W = 48;
const PIN_H = 58; // the ring plus the tail

export function ShopMap({ pins }: { pins: MapPin[] }) {
  const { t, f, href } = useI18n();
  const el = useRef<HTMLDivElement>(null);
  const markers = useRef(new Map<string, { marker: Marker; pin: MapPin }>());
  const map = useRef<LeafletMap | null>(null);
  const [ready, setReady] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Draw the map once. Leaflet needs the window, so it is loaded here, not at import time.
  useEffect(() => {
    let cancelled = false;
    const drawn = markers.current;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current) return;

      const b = MAP_AREA.bounds;
      const city = L.latLngBounds([b.south, b.west], [b.north, b.east]);
      const m = L.map(el.current, {
        center: [MAP_AREA.center.lat, MAP_AREA.center.lng],
        zoom: MAP_AREA.zoom,
        minZoom: MAP_AREA.minZoom,
        maxZoom: MAP_AREA.maxZoom,
        zoomSnap: 0.5, // half steps: the city's box fits the screen closely
        // Sulaymaniyah only: the view can't leave the city's box…
        maxBounds: city,
        maxBoundsViscosity: 1,
        zoomControl: false,
        attributionControl: false,
      });
      // …and can't zoom out to where the box no longer fills the screen (a tall phone shows less
      // of the city than a wide tablet). Worked out again when the screen turns or resizes.
      const fitMinZoom = () => m.setMinZoom(Math.min(Math.max(m.getBoundsZoom(city, true), MAP_AREA.minZoom), MAP_AREA.maxZoom - 1));
      fitMinZoom();
      m.on("resize", fitMinZoom);
      if (m.getZoom() < m.getMinZoom()) m.setZoom(m.getMinZoom(), { animate: false });
      L.control.zoom({ position: "topright" }).addTo(m);
      L.control.attribution({ position: "topleft", prefix: false }).addTo(m);
      L.tileLayer(TILES, { maxZoom: MAP_AREA.maxZoom, attribution: "© OpenStreetMap" }).addTo(m);

      for (const pin of pins) {
        const marker = L.marker([pin.lat, pin.lng], {
          icon: L.divIcon({ html: pinHtml(pin, false), className: "kb-pin-wrap", iconSize: [PIN_W, PIN_H], iconAnchor: [PIN_W / 2, PIN_H] }),
          title: pin.name,
          keyboard: true,
        }).addTo(m);
        marker.on("click", () => setSelectedId(pin.locationId));
        drawn.set(pin.locationId, { marker, pin });
      }
      m.on("click", () => setSelectedId(null));

      if (pins.length > 0) m.fitBounds(L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number])), { padding: [70, 70], maxZoom: 16 });
      map.current = m;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      drawn.clear();
    };
  }, [pins]);

  // The chosen pin grows and comes to the front.
  useEffect(() => {
    if (!ready) return;
    void (async () => {
      const L = (await import("leaflet")).default;
      for (const [id, { marker, pin }] of markers.current) {
        const on = id === selectedId;
        marker.setIcon(L.divIcon({ html: pinHtml(pin, on), className: "kb-pin-wrap", iconSize: [PIN_W, PIN_H], iconAnchor: [PIN_W / 2, PIN_H] }));
        marker.setZIndexOffset(on ? 1000 : 0);
      }
    })();
  }, [selectedId, ready]);

  const pin = pins.find((p) => p.locationId === selectedId) ?? null;
  const kinds = pin ? (pin.kind === "both" ? (["barber", "salon"] as const) : ([pin.kind] as const)) : [];
  const where = pin ? [pin.locationName, pin.address, pin.city].filter(Boolean).join(" · ") : "";

  return (
    // isolate: Leaflet's own z-indexes (up to 1000) stay inside the map, under the header and the tab bar.
    <div className="kb-map relative isolate size-full overflow-hidden bg-neutral-100">
      <div ref={el} dir="ltr" role="application" aria-label={t.mapPage.label} className="absolute inset-0" />

      {!ready && <div className="absolute inset-0 z-[1100] animate-pulse bg-neutral-100" aria-hidden />}

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
