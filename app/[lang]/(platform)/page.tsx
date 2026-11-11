import Link from "next/link";
import { CalendarCheck, Images, Megaphone, MapPin, MonitorSmartphone, BadgeCheck } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";

// Same order as t.landing.features.
const ICONS = [CalendarCheck, Images, Megaphone, MapPin, MonitorSmartphone, BadgeCheck];

export default async function Landing() {
  const { t, href } = await getI18n();
  const l = t.landing;
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-14 text-center sm:pt-20">
        <h1 className="text-4xl font-bold leading-tight text-slate-900 sm:text-6xl">
          {l.titleBefore}<span className="text-brand-gradient">{l.titleKey}</span>{l.titleAfter}
          <br />
          {l.titleLine2}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">{l.subtitle}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href={href("/signup")} className="btn-primary px-6 py-3 text-base">{l.cta}</Link>
          <Link href={href("/pricing")} className="btn-ghost px-6 py-3 text-base">{t.platform.pricing}</Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-20 sm:grid-cols-2 lg:grid-cols-3">
        {l.features.map(({ title, text }, i) => {
          const Icon = ICONS[i] ?? BadgeCheck;
          return (
            <div key={title} className="card">
              <span className="grid size-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600"><Icon className="size-6" aria-hidden /></span>
              <h2 className="mt-4 text-lg font-bold text-slate-900">{title}</h2>
              <p className="mt-1 text-sm text-slate-600">{text}</p>
            </div>
          );
        })}
      </section>
    </>
  );
}
