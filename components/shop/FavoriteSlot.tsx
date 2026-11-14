import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/customer";
import { FavoriteButton } from "@/components/shop/FavoriteButton";

/**
 * The heart, with the viewer's saved state. Reads the session: render it
 * inside <Suspense>. Shop accounts don't get one (they book from a customer
 * profile).
 */
export async function FavoriteSlot({ shopId, loginHref }: { shopId: string; loginHref: string }) {
  await connection(); // the session check compares token expiry with the current time
  const viewer = await getViewer();
  if (viewer.kind === "staff") return null;
  if (viewer.kind === "guest") return <FavoriteButton shopId={shopId} saved={null} loginHref={loginHref} />;
  const supabase = await createClient();
  const { data } = await supabase
    .from("favorite_shops")
    .select("shop_id")
    .eq("user_id", viewer.customer.id)
    .eq("shop_id", shopId)
    .maybeSingle();
  return <FavoriteButton shopId={shopId} saved={!!data} loginHref={loginHref} />;
}
