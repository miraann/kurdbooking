import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { displayPhone, whatsappLink } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { SHOP_KIND } from "@/lib/labels";
import type { ShopKind } from "@/lib/types";
import { setRequestStatus } from "@/app/[lang]/super/actions";
import { ActionButton } from "@/components/ui/ActionButton";

type ShopRequest = {
  id: string;
  shop_name: string;
  kind: ShopKind;
  owner_name: string;
  phone: string;
  city: string | null;
  note: string | null;
  status: "new" | "done" | "rejected";
  shop_id: string | null;
  created_at: string;
};

const STATUS_STYLE = {
  new: "bg-indigo-50 text-indigo-700",
  done: "bg-emerald-50 text-emerald-700",
  rejected: "bg-slate-100 text-slate-500",
} as const;

/** Orders sent from /signup. You call the owner, then create the shop. */
export default async function SuperRequests() {
  const [, { lang, t, f, href }] = await Promise.all([requireSuperAdmin(), getI18n()]);
  const r = t.super.requests;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shop_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw error;
  const all = (data ?? []) as ShopRequest[];
  // New orders first, then the rest, newest first in each group.
  const rows = [...all.filter((x) => x.status === "new"), ...all.filter((x) => x.status !== "new")];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">{t.super.nav.requests}</h1>
        <Link href={href("/super/shops/new")} className="btn-primary">{t.super.shops.newShop}</Link>
      </div>
      <p className="text-sm text-slate-600">{r.help}</p>

      {rows.length === 0 ? (
        <p className="card text-center text-slate-500">{r.empty}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((x) => (
            <li key={x.id} className={`card space-y-2 ${x.status === "new" ? "" : "opacity-70"}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-bold text-slate-900">{x.shop_name}</span>
                <span className="text-sm text-slate-500">{SHOP_KIND[x.kind][lang]}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[x.status]}`}>{r.statuses[x.status]}</span>
                <span className="ms-auto text-xs text-slate-400">{f.shortDate(x.created_at)}</span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-700">
                <span>{x.owner_name}</span>
                <span dir="ltr">{displayPhone(x.phone)}</span>
                {x.city && <span>{x.city}</span>}
              </div>
              {x.note && <p className="whitespace-pre-line rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{x.note}</p>}
              <div className="flex flex-wrap gap-2 pt-1">
                <a href={`tel:+${x.phone}`} className="btn-ghost">{t.common.call}</a>
                <a href={whatsappLink(x.phone)} target="_blank" rel="noreferrer" className="btn-ghost">{t.common.whatsapp}</a>
                {x.status === "new" && (
                  <>
                    <Link href={href(`/super/shops/new?request=${x.id}`)} className="btn-primary">{r.create}</Link>
                    <ActionButton action={setRequestStatus.bind(null, x.id, "rejected")} confirmText={r.rejectQ} className="btn-ghost">
                      {r.reject}
                    </ActionButton>
                  </>
                )}
                {x.status === "rejected" && (
                  <ActionButton action={setRequestStatus.bind(null, x.id, "new")} className="btn-ghost">{r.restore}</ActionButton>
                )}
                {x.status === "done" && x.shop_id && (
                  <Link href={href(`/super/shops/${x.shop_id}`)} className="btn-tonal">{r.openShop}</Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
