import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Field } from "@/lib/fields";

/**
 * Fills select fields whose options come from the shop's own data
 * (`optionsFrom: "staff"`). Used by <ResourceEditor> to draw the form and by
 * saveResource() to validate it, so a staff id from another shop is rejected
 * before the database's foreign key even sees it.
 */
export async function withShopOptions(fields: Field[], supabase: SupabaseClient, shopId: string): Promise<Field[]> {
  if (!fields.some((f) => f.type === "select" && f.optionsFrom === "staff")) return fields;

  const { data, error } = await supabase.from("staff").select("id, name").eq("shop_id", shopId).order("sort_order");
  if (error) throw error;
  const staff = (data ?? []).map((s) => ({ value: s.id as string, label: s.name as string }));

  return fields.map((f) => (f.type === "select" && f.optionsFrom === "staff" ? { ...f, options: staff } : f));
}
