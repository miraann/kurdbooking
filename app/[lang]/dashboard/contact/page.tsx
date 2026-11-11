import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { ResourceEditor } from "@/components/dashboard/ResourceEditor";

export default async function ContactPage() {
  const { t, href } = await getI18n();
  const c = t.dashboard.contact;
  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">{c.title}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {c.hintBefore}<Link href={href("/dashboard/profile")} className="text-brand underline">{c.hintLink}</Link>{c.hintAfter}
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">{c.social}</h2>
        <ResourceEditor resource="social_links" />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">{c.locations}</h2>
        <ResourceEditor resource="locations" />
      </section>
    </div>
  );
}
