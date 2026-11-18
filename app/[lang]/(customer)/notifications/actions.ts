"use server";

import { getViewer } from "@/lib/customer";
import { createClient } from "@/lib/supabase/server";

/**
 * Marks the customer's notifications as read (the page was opened). Returns
 * whether it worked. Row-level security and the column grant (0019) let an
 * account change only its own read_at, whatever is sent here.
 */
export async function markNotificationsRead(): Promise<boolean> {
  const viewer = await getViewer();
  if (viewer.kind !== "customer") return false;
  const supabase = await createClient();
  const { error } = await supabase
    .from("customer_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", viewer.customer.id)
    .is("read_at", null);
  return !error;
}
