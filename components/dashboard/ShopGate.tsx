import Link from "next/link";
import { ExternalLink, LogOut } from "lucide-react";
import { requireShop } from "@/lib/auth";
import { shopUrl } from "@/lib/tenant";
import { daysUntil, fill } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { signOut, switchShop } from "@/app/[lang]/dashboard/actions";

/**
 * Top of every dashboard page: which shop, its public link, the
 * subscription status. Reads the session → lives inside <Suspense>.
 */
export async function ShopGate({ children }: { children: React.ReactNode }) {
  const [{ shop, shops }, { t, f, href }] = await Promise.all([requireShop(), getI18n()]);
  const g = t.dashboard.gate;
  const publicUrl = shopUrl(shop.slug);
  const endsAt = shop.status === "trial" ? shop.trial_ends_at : shop.paid_until;
  const daysLeft = endsAt ? daysUntil(endsAt) : null;
  const billing = href("/dashboard/billing");

  return (
    <>
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold">{shop.name}</h1>
          {shops.length > 1 && (
            <form className="my-1 flex flex-wrap gap-2">
              {shops.filter((s) => s.id !== shop.id).map((s) => (
                <button key={s.id} formAction={switchShop.bind(null, s.id)} className="btn-ghost px-3 py-1 text-xs">
                  {fill(g.switchTo, { name: s.name })}
                </button>
              ))}
            </form>
          )}
          <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-brand" dir="ltr">
            {publicUrl.replace(/^https?:\/\//, "")}
            <ExternalLink className="size-3" aria-hidden />
          </a>
        </div>
        <form action={signOut}>
          <button className="btn-ghost px-3 py-2" aria-label={t.common.logout}>
            <LogOut className="size-4" aria-hidden />
          </button>
        </form>
      </header>

      {shop.status === "trial" && daysLeft != null && (
        <Banner tone="info">
          {fill(g.trial, { days: f.days(Math.max(daysLeft, 0)), date: f.shortDate(endsAt, shop.timezone) })}{" "}
          <Link href={billing} className="font-semibold underline">{g.subscription}</Link>
        </Banner>
      )}
      {shop.status === "past_due" && (
        <Banner tone="warn">
          {g.pastDue}{" "}
          <Link href={billing} className="font-semibold underline">{g.renew}</Link>
        </Banner>
      )}
      {(shop.status === "suspended" || shop.status === "cancelled") && (
        <Banner tone="danger">
          {shop.status === "suspended" ? g.suspended : g.cancelled}{" "}
          <Link href={billing} className="font-semibold underline">{g.reactivate}</Link>
        </Banner>
      )}

      {children}
    </>
  );
}

function Banner({ tone, children }: { tone: "info" | "warn" | "danger"; children: React.ReactNode }) {
  const styles = {
    info: "border-brand/20 bg-brand-soft text-brand",
    warn: "border-amber-300 bg-amber-50 text-amber-900",
    danger: "border-rose-300 bg-rose-50 text-rose-900",
  }[tone];
  return <div className={`mb-6 rounded-xl border px-4 py-3 text-sm ${styles}`}>{children}</div>;
}
