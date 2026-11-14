"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/customer";
import { getActionI18n } from "@/lib/i18n/request";

// The heart on a shop page: a customer saves or removes a favourite shop.
// RLS (0013) lets each account touch only its own rows, and only live shops.

export async function setFavorite(shopId: string, on: boolean): Promise<{ ok: boolean; message?: string; needProfile?: boolean }> {
  const { t } = await getActionI18n();
  const viewer = await getViewer();
  if (viewer.kind !== "customer") return { ok: false, needProfile: true, message: t.shop.favoriteNeedsProfile };
  if (!z.uuid().safeParse(shopId).success) return { ok: false, message: t.errors.invalidData };

  const supabase = await createClient();
  const { error } = on
    ? await supabase.from("favorite_shops").upsert({ user_id: viewer.customer.id, shop_id: shopId }, { onConflict: "user_id,shop_id", ignoreDuplicates: true })
    : await supabase.from("favorite_shops").delete().eq("user_id", viewer.customer.id).eq("shop_id", shopId);
  if (error) {
    console.error("favourite failed", error.code, error.message);
    return { ok: false, message: t.errors.generic };
  }
  return { ok: true };
}
