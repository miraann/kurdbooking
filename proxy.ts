// Runs before every page request (Next.js 16 renamed middleware → proxy).
//
// 1. Language: every page lives under app/[lang]/. Kurdish has no prefix
//    (/dashboard is rewritten to /ckb/dashboard); Arabic and English are
//    /ar/… and /en/…. /ckb/… redirects to the clean URL. A visitor who picked
//    a language (cookie kb_lang) is sent from an unprefixed link to it.
//    The language is also put in a request header for Server Actions.
// 2. Shop subdomains:  ali.kurdbooking.com/ar/book  →  /ar/s/ali/book  (rewrite)
//    Only when NEXT_PUBLIC_ROOT_DOMAIN is set. Without it, shops live at
//    /s/<slug> on the main site and nothing is rewritten.
// 3. Pages that read the login (/dashboard, /super, /login, /reset-password,
//    and the customer's /account and booking page): refreshes the Supabase
//    session cookie (Server Components can't write it). Logged-out visitors of
//    /dashboard and /super go to their login: /login for shops, /super/login
//    for the super admin (two separate logins). Customers need a profile only
//    to book; the booking page asks for it itself.
//
// Pages still check the user themselves (lib/auth.ts); this is not the only
// guard. See the Next.js 16 proxy docs: node_modules/next/dist/docs.

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { DEFAULT_LANG, isLang, LANG_COOKIE, LANG_HEADER, localePath, splitLocale } from "@/lib/i18n/config";

const ROOT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "").toLowerCase().trim();
const NOT_SHOPS = new Set(["www", "app"]);
const SHOP_HOST_HEADER = "x-kb-shop-host"; // same name as lib/tenant.ts

function shopSlugFromHost(host: string): string | null {
  if (!ROOT_DOMAIN) return null;
  const h = host.toLowerCase();
  if (h === ROOT_DOMAIN || !h.endsWith(`.${ROOT_DOMAIN}`)) return null;
  const sub = h.slice(0, -(ROOT_DOMAIN.length + 1));
  if (!sub || sub.includes(".") || NOT_SHOPS.has(sub)) return null;
  return sub;
}

const PROTECTED = ["/dashboard", "/super"];
const SUPER_LOGIN = "/super/login";
// /reset-password: the reset link's session must stay fresh (no redirect there).
const NEEDS_SESSION = [...PROTECTED, "/login", "/reset-password", "/account"];
const under = (path: string, list: string[]) => list.some((p) => path === p || path.startsWith(`${p}/`));
/** The booking page: /s/<slug>/book on the main site, /book on a shop subdomain. */
const isBookPage = (path: string, onSubdomain: boolean) => (onSubdomain ? path === "/book" : /^\/s\/[^/]+\/book$/.test(path));

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const headers = new Headers(request.headers);
  headers.delete(SHOP_HOST_HEADER); // never trust these from the browser
  headers.delete(LANG_HEADER);

  // The JSON API has no language and no session work.
  if (pathname.startsWith("/api/")) return NextResponse.next({ request: { headers } });

  // ── 1. Language ──────────────────────────────────────────────────────────
  const { lang, path, prefix } = splitLocale(pathname);

  if (prefix === DEFAULT_LANG) {
    // /ckb/dashboard → /dashboard (one URL per page)
    const url = request.nextUrl.clone();
    url.pathname = path;
    return NextResponse.redirect(url);
  }

  if (!prefix && request.method === "GET") {
    const saved = request.cookies.get(LANG_COOKIE)?.value;
    if (isLang(saved) && saved !== DEFAULT_LANG) {
      const url = request.nextUrl.clone();
      url.pathname = localePath(saved, path);
      return NextResponse.redirect(url);
    }
  }
  headers.set(LANG_HEADER, lang);

  // ── 2. Shop subdomain → internal path ────────────────────────────────────
  const slug = shopSlugFromHost(request.headers.get("host") ?? "");
  let internal: string;
  if (slug) {
    headers.set(SHOP_HOST_HEADER, slug);
    internal = `/${lang}/s/${slug}${path === "/" ? "" : path}`;
  } else {
    internal = `/${lang}${path === "/" ? "" : path}`;
  }

  const forward = () => {
    if (internal === pathname) return NextResponse.next({ request: { headers } });
    const url = request.nextUrl.clone();
    url.pathname = internal;
    url.search = search;
    return NextResponse.rewrite(url, { request: { headers } });
  };

  // ── 3. Session refresh ───────────────────────────────────────────────────
  const needsSession = isBookPage(path, !!slug) || (!slug && under(path, NEEDS_SESSION));
  if (!needsSession) return forward();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return forward(); // pages show the setup error

  let response = forward();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, cacheHeaders) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        headers.set("cookie", request.cookies.toString()); // the page sees the refreshed session too
        response = forward();
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(cacheHeaders ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  // Validates the token (and refreshes it when needed).
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims && under(path, PROTECTED) && path !== SUPER_LOGIN) {
    const login = request.nextUrl.clone();
    login.pathname = localePath(lang, under(path, ["/super"]) ? SUPER_LOGIN : "/login");
    login.search = `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(login);
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals and static files.
    // sw.js (push alerts) must stay at the site root, not under a language.
    // .apk: the customer Android app download (public/kurdbooking.apk).
    "/((?!_next/static|_next/image|favicon\\.ico|sw\\.js|font/|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|otf|txt|xml|json|webmanifest|apk)$).*)",
  ],
};
