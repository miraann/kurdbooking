import Link from "next/link";
import type { Metadata } from "next";
import { getI18n } from "@/lib/i18n/server";
import { SignupForm } from "./SignupForm";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.signup.metaTitle };
}

export default async function SignupPage() {
  const { t, href } = await getI18n();
  return (
    <section className="mx-auto max-w-xl px-4 py-12">
      <h1 className="mb-2 text-center text-3xl font-bold text-slate-900">
        {t.signup.titleBefore}<span className="text-brand-gradient">{t.signup.titleKey}</span>
      </h1>
      <p className="mb-8 text-center text-slate-600">{t.signup.subtitle}</p>
      <SignupForm />
      <p className="mt-6 text-center text-sm text-slate-600">
        {t.signup.haveAccount} <Link href={href("/login")} className="font-semibold text-brand">{t.signup.goLogin}</Link>
      </p>
    </section>
  );
}
