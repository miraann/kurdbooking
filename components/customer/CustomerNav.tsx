"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Heart, House, UserRound, type LucideIcon } from "lucide-react";
import { splitLocale } from "@/lib/i18n/config";
import { fill } from "@/lib/format";
import { useI18n } from "@/components/i18n/I18nProvider";
import { refreshUnread, useUnread } from "@/components/customer/unread";

// The customer side's navigation: a native-style tab bar floating at the bottom
// on phones (and in the customer app), plain links in the header from tablets
// up. Four places: Home (the shop list), Favourites, Notifications, Profile.
// Shop pages and booking have their own layout, so the bar is only on these
// four, as in a native app.

type TabKey = "home" | "favorites" | "notifications" | "profile";
const TABS: { key: TabKey; path: string; icon: LucideIcon }[] = [
  { key: "home", path: "/", icon: House },
  { key: "favorites", path: "/favorites", icon: Heart },
  { key: "notifications", path: "/notifications", icon: Bell },
  { key: "profile", path: "/account", icon: UserRound },
];

const isActive = (pathname: string | null, to: string) =>
  pathname !== null && (to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`));

// usePathname() isn't known while a page with unknown params is prerendered: the nav first
// renders without a highlight and streams in (the same rule as the dashboard nav).
const usePath = () => splitLocale(usePathname()).path; // without /ar or /en

/** The red number on the notifications tab. */
function Badge({ className = "" }: { className?: string }) {
  const { t, f } = useI18n();
  const unread = useUnread();
  if (unread <= 0) return null;
  return (
    <span
      className={`absolute grid min-w-[1.1rem] place-items-center rounded-full px-1 text-[0.62rem] font-bold leading-[1.1rem] text-white ring-2 ring-white ${className}`}
      style={{ background: "var(--shop-accent)" }}
    >
      {unread > 9 ? `${f.num(9)}+` : f.num(unread)}
      <span className="sr-only"> {fill(t.customerNav.unread, { n: f.num(unread) })}</span>
    </span>
  );
}

// ── Phones: the floating tab bar ─────────────────────────────────────────────

function TabBarView({ pathname }: { pathname: string | null }) {
  const { t, href } = useI18n();
  // Native apps hide the bar while you type; here the keyboard would otherwise lift it over the form.
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const isField = (el: Element | null) =>
      el instanceof HTMLTextAreaElement ||
      (el instanceof HTMLInputElement && !["checkbox", "radio", "button", "submit", "range", "file"].includes(el.type));
    const onIn = () => setTyping(isField(document.activeElement));
    let timer: ReturnType<typeof setTimeout>;
    const onOut = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setTyping(isField(document.activeElement)), 60);
    };
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
    };
  }, []);

  // Keep the notifications number fresh (once for the whole page: the header links read the same value).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshUnread();
    };
    const timer = setInterval(onVisible, 60_000);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  useEffect(() => {
    if (pathname !== null) void refreshUnread(); // on first show and after every move to another tab
  }, [pathname]);

  return (
    <nav
      aria-label={t.customerNav.label}
      className={`pointer-events-none fixed inset-x-0 z-40 px-4 transition-transform duration-300 ease-out md:hidden ${typing ? "translate-y-[160%]" : ""}`}
      style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <ul className="pointer-events-auto mx-auto flex max-w-sm items-stretch gap-1 rounded-[1.75rem] border border-white/80 bg-white/90 p-1.5 shadow-[0_12px_40px_-10px_rgb(15_23_42/0.3)] ring-1 ring-neutral-900/5 backdrop-blur-xl">
        {TABS.map(({ key, path, icon: Icon }) => {
          const active = isActive(pathname, path);
          return (
            <li key={key} className="min-w-0 flex-1">
              <Link
                href={href(path)}
                aria-current={active ? "page" : undefined}
                className={`group flex touch-manipulation select-none flex-col items-center gap-1 rounded-3xl py-1.5 transition-transform active:scale-95 ${active ? "" : "text-neutral-500"}`}
                style={active ? { color: "var(--shop-primary)" } : undefined}
              >
                <span
                  className={`relative grid h-8 w-16 place-items-center rounded-full transition-colors duration-300 ${active ? "" : "group-active:bg-neutral-100"}`}
                  style={active ? { background: "color-mix(in srgb, var(--shop-primary) 13%, white)" } : undefined}
                >
                  <Icon className={`size-[1.35rem] transition-transform duration-300 ${active ? "scale-110" : ""}`} strokeWidth={active ? 2.4 : 2} aria-hidden />
                  {key === "notifications" && <Badge className="end-2 top-0" />}
                </span>
                <span className={`max-w-full truncate px-1 text-[0.7rem] leading-none ${active ? "font-bold" : "font-medium"}`}>{t.customerNav[key]}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function TabBarAtPath() {
  return <TabBarView pathname={usePath()} />;
}

/** The floating tab bar (phones only). */
export function CustomerTabBar() {
  return (
    <Suspense fallback={<TabBarView pathname={null} />}>
      <TabBarAtPath />
    </Suspense>
  );
}

// ── Tablets and desktops: links in the header ────────────────────────────────

function HeaderLinksView({ pathname }: { pathname: string | null }) {
  const { t, href } = useI18n();
  return (
    <nav aria-label={t.customerNav.label} className="hidden items-center gap-1 md:flex">
      {TABS.filter((tab) => tab.key !== "home").map(({ key, path, icon: Icon }) => {
        const active = isActive(pathname, path);
        if (key === "profile") {
          return (
            <Link
              key={key}
              href={href(path)}
              aria-current={active ? "page" : undefined}
              className="ms-1 flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-bold text-white transition active:scale-95"
              style={{ background: "var(--shop-primary)" }}
            >
              <Icon className="size-4" aria-hidden />
              {t.customerNav[key]}
            </Link>
          );
        }
        return (
          <Link
            key={key}
            href={href(path)}
            aria-current={active ? "page" : undefined}
            className={`relative flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition active:scale-95 ${active ? "" : "text-neutral-600 hover:bg-neutral-100"}`}
            style={active ? { color: "var(--shop-primary)", background: "color-mix(in srgb, var(--shop-primary) 10%, white)" } : undefined}
          >
            <Icon className="size-4" aria-hidden />
            {t.customerNav[key]}
            {key === "notifications" && <Badge className="end-0.5 top-0.5" />}
          </Link>
        );
      })}
    </nav>
  );
}

function HeaderLinksAtPath() {
  return <HeaderLinksView pathname={usePath()} />;
}

/** Favourites, notifications and profile as header links (from tablets up). */
export function CustomerHeaderLinks() {
  return (
    <Suspense fallback={<HeaderLinksView pathname={null} />}>
      <HeaderLinksAtPath />
    </Suspense>
  );
}
