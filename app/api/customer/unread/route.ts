import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isCustomerMeta } from "@/lib/customer";

// How many notifications the logged-in customer hasn't opened yet: the red number
// on the app's notifications tab (components/customer/CustomerNav.tsx asks for it
// when a tab opens, when the app returns to the front, and once a minute).
// Guests and shop accounts get 0. Row-level security limits the count to the
// customer's own rows; the user id filter is only there to say so.
export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  let unread = 0;
  if (claims?.sub && isCustomerMeta(claims.app_metadata)) {
    const { count } = await supabase
      .from("customer_notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", claims.sub)
      .is("read_at", null);
    unread = count ?? 0;
  }
  return NextResponse.json({ unread }, { headers: { "Cache-Control": "no-store" } });
}
