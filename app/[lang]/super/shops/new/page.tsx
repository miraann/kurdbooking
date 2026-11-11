import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { displayPhone, fill } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { NewShopForm } from "./NewShopForm";

/** Only you create shops. ?request=<id> fills the form from a /signup order. */
export default async function SuperNewShop({ searchParams }: PageProps<"/[lang]/super/shops/new">) {
  const [, { t, href }] = await Promise.all([requireSuperAdmin(), getI18n()]);
  const n = t.super.newShop;
  const { request } = await searchParams;
  const requestId = typeof request === "string" && /^[0-9a-f-]{36}$/i.test(request) ? request : undefined;

  let initial: Record<string, string> = {};
  let fromName = "";
  if (requestId) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("shop_requests")
      .select("shop_name, kind, owner_name, phone")
      .eq("id", requestId)
      .maybeSingle();
    if (data) {
      initial = { shop_name: data.shop_name, kind: data.kind, owner_name: data.owner_name, phone: displayPhone(data.phone) };
      fromName = data.shop_name;
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <Link href={href(requestId ? "/super/requests" : "/super/shops")} className="text-sm font-semibold text-brand">{t.common.back}</Link>
        <h1 className="page-title mt-2">{n.title}</h1>
        <p className="mt-1 text-sm text-slate-600">{n.help}</p>
        {fromName && <p className="mt-2 text-sm font-semibold text-indigo-600">{fill(n.fromRequest, { name: fromName })}</p>}
      </div>
      <NewShopForm initial={initial} requestId={fromName ? requestId : undefined} />
    </div>
  );
}
