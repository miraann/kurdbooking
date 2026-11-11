import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/lib/i18n/server";
import { SHOP_KIND, SHOP_STATUS } from "@/lib/labels";
import type { Shop } from "@/lib/types";

export default async function SuperShops({ searchParams }: PageProps<"/[lang]/super/shops">) {
  const [, { lang, t, f, href }] = await Promise.all([requireSuperAdmin(), getI18n()]);
  const s = t.super.shops;
  const { q: rawQ, status } = await searchParams;
  const q = typeof rawQ === "string" ? rawQ.trim().slice(0, 60) : "";
  const supabase = await createClient();

  let query = supabase.from("shops").select("*").order("created_at", { ascending: false }).limit(500);
  if (q) query = query.or(`name.ilike.%${q.replace(/[%,()]/g, "")}%,slug.ilike.%${q.replace(/[%,()]/g, "")}%`);
  if (typeof status === "string" && status in SHOP_STATUS) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  const shops = (data ?? []) as Shop[];

  return (
    <div className="space-y-5">
      <h1 className="page-title">{t.super.nav.shops}</h1>
      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder={s.searchPlaceholder} className="input max-w-xs" />
        <select name="status" defaultValue={typeof status === "string" ? status : ""} className="input w-auto">
          <option value="">{s.allStatuses}</option>
          {Object.entries(SHOP_STATUS).map(([k, v]) => (
            <option key={k} value={k}>{v[lang]}</option>
          ))}
        </select>
        <button className="btn-primary">{t.common.search}</button>
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="p-3 text-start font-medium">{s.shop}</th>
              <th className="p-3 text-start font-medium">{s.kind}</th>
              <th className="p-3 text-start font-medium">{s.status}</th>
              <th className="p-3 text-start font-medium">{s.ends}</th>
              <th className="p-3 text-start font-medium">{s.created}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shops.map((shop) => (
              <tr key={shop.id} className="hover:bg-slate-50">
                <td className="p-3">
                  <Link href={href(`/super/shops/${shop.id}`)} className="font-semibold text-brand">{shop.name}</Link>
                  <div className="text-xs text-slate-400" dir="ltr">{shop.slug}</div>
                </td>
                <td className="p-3">{SHOP_KIND[shop.kind][lang]}</td>
                <td className="p-3">{SHOP_STATUS[shop.status][lang]}</td>
                <td className="p-3">{f.shortDate(shop.status === "trial" ? shop.trial_ends_at : shop.paid_until, shop.timezone)}</td>
                <td className="p-3">{f.shortDate(shop.created_at, shop.timezone)}</td>
              </tr>
            ))}
            {shops.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-slate-500">{s.empty}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
