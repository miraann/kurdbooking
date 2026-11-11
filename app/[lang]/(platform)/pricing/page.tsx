import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { getI18n } from "@/lib/i18n/server";
import type { Plan } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.pricing.title };
}

async function getPublicPlans(): Promise<Plan[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("plans");
  try {
    const { data } = await createPublicClient().from("plans").select("*").eq("is_public", true).order("sort_order");
    return (data ?? []) as Plan[];
  } catch {
    return []; // no Supabase configured (e.g. a local build without .env.local)
  }
}

export default async function PricingPage() {
  const { t } = await getI18n();
  return (
    <section className="mx-auto max-w-5xl px-4 py-14">
      <h1 className="text-center text-4xl font-bold text-slate-900">
        <span className="text-brand-gradient">{t.pricing.title}</span>
      </h1>
      <p className="mt-3 text-center text-slate-600">{t.pricing.subtitle}</p>
      <Suspense fallback={<div className="mt-10 h-40 animate-pulse rounded-2xl bg-white/60" />}>
        <Plans />
      </Suspense>
    </section>
  );
}

async function Plans() {
  const [plans, { t, f, href }] = await Promise.all([getPublicPlans(), getI18n()]);
  if (plans.length === 0) {
    return <p className="card mt-10 text-center text-slate-500">{t.pricing.empty}</p>;
  }
  return (
    <div className="mt-10 grid gap-5 md:grid-cols-3">
      {plans.map((p) => (
        <div key={p.id} className="card flex flex-col">
          <h2 className="text-xl font-bold text-slate-900">{p.name}</h2>
          <p className="mt-3 text-3xl font-bold">
            {f.iqd(p.price_iqd)}
            <span className="text-sm font-normal text-slate-500"> / {f.months(p.period_months)}</span>
          </p>
          {p.description && <p className="mt-3 flex-1 whitespace-pre-line text-sm text-slate-600">{p.description}</p>}
          <Link href={href("/signup")} className="btn-primary mt-5">{t.platform.start}</Link>
        </div>
      ))}
    </div>
  );
}
