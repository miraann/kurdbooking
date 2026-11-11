import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { MemberRole, Shop } from "@/lib/types";
import { localePath } from "@/lib/i18n/config";
import { getRequestLang } from "@/lib/i18n/request";

/** redirect() to a path in the current request's language. */
async function go(path: string): Promise<never> {
  redirect(localePath(await getRequestLang(), path));
}

// Data Access Layer: every page and Server Action that needs a user goes
// through these helpers. They read cookies, so call them inside <Suspense>,
// a Server Action or a Route Handler. React's cache() dedupes them per request.

export const CURRENT_SHOP_COOKIE = "kb_shop";

export interface SessionUser {
  id: string;
  email: string;
}

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : "" };
});

export async function requireUser(next = "/dashboard"): Promise<SessionUser> {
  const user = await getSessionUser();
  // Two logins: /super/login for you, /login for shops.
  const login = next === "/super" || next.startsWith("/super/") ? "/super/login" : "/login";
  if (!user) return go(`${login}?next=${encodeURIComponent(next)}`);
  return user;
}

export const getProfile = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("full_name, phone, is_super_admin")
    .eq("id", userId)
    .maybeSingle();
  return data as { full_name: string; phone: string | null; is_super_admin: boolean } | null;
});

/** For /super pages and actions. Non-admins get sent to their dashboard. */
export async function requireSuperAdmin() {
  const user = await requireUser("/super");
  const profile = await getProfile(user.id);
  if (!profile?.is_super_admin) return go("/dashboard");
  return { ...user, fullName: profile.full_name };
}

export interface ShopContext {
  user: SessionUser;
  shop: Shop;
  role: MemberRole;
  shops: { id: string; name: string; slug: string }[]; // every shop this user belongs to
}

/** The shop the logged-in owner is working on (cookie kb_shop, else their first). */
export const getShopContext = cache(async (): Promise<ShopContext | null> => {
  const user = await getSessionUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("shop_members")
    .select("role, shops(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const memberships = (data ?? []).flatMap((m) => {
    const shop = m.shops as unknown as Shop | null;
    return shop ? [{ role: m.role as MemberRole, shop }] : [];
  });
  if (memberships.length === 0) return null;

  const wanted = (await cookies()).get(CURRENT_SHOP_COOKIE)?.value;
  const current = memberships.find((m) => m.shop.id === wanted) ?? memberships[0];

  return {
    user,
    shop: current.shop,
    role: current.role,
    shops: memberships.map((m) => ({ id: m.shop.id, name: m.shop.name, slug: m.shop.slug })),
  };
});

/**
 * For /dashboard pages and actions. Logged-out → /login; no shop yet →
 * /signup, the order form (or /super for you). Pass roles to restrict, e.g. ["owner"].
 */
export async function requireShop(roles?: MemberRole[]): Promise<ShopContext> {
  const user = await requireUser("/dashboard");
  const ctx = await getShopContext();
  if (!ctx) {
    const profile = await getProfile(user.id);
    return go(profile?.is_super_admin ? "/super" : "/signup");
  }
  if (roles && !roles.includes(ctx.role)) return go("/dashboard");
  return ctx;
}

export const canManage = (role: MemberRole) => role === "owner" || role === "manager";
