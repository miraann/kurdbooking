import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import { getSupportWhatsapp } from "@/lib/shop-data";
import { whatsappLink } from "@/lib/format";
import { ForgotForm } from "./ForgotForm";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.password.forgotTitle, robots: { index: false, follow: false } };
}

export default async function ForgotPasswordPage({ searchParams }: PageProps<"/[lang]/forgot-password">) {
  const [{ t, href }, support] = await Promise.all([getI18n(), getSupportWhatsapp()]);
  return (
    <section className="mx-auto max-w-md px-4 py-14">
      <h1 className="mb-3 text-center text-3xl font-bold text-slate-900">
        <span className="text-brand-gradient">{t.password.forgotTitle}</span>
      </h1>
      <p className="mb-8 text-center text-slate-600">{t.password.forgotHelp}</p>
      {/* searchParams is request data → read it behind Suspense (Cache Components). */}
      <Suspense fallback={<ForgotForm />}>
        <ForgotWithError searchParams={searchParams} />
      </Suspense>
      {support && (
        <div className="mt-6 space-y-3 text-center text-sm text-slate-600">
          <p>{t.password.noEmail}</p>
          <a href={whatsappLink(support, t.password.whatsappText)} target="_blank" rel="noreferrer" className="btn-tonal">
            <MessageCircle className="size-4" aria-hidden />
            {t.password.askWhatsapp}
          </a>
        </div>
      )}
      <p className="mt-6 text-center text-sm">
        <Link href={href("/login")} className="font-semibold text-brand">{t.password.backToLogin}</Link>
      </p>
    </section>
  );
}

async function ForgotWithError({ searchParams }: Pick<PageProps<"/[lang]/forgot-password">, "searchParams">) {
  const { error } = await searchParams;
  return <ForgotForm linkError={error === "link"} />;
}
