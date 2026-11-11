import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { getI18n } from "@/lib/i18n/server";
import { LoginForm } from "./LoginForm";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.login.title };
}

export default async function LoginPage({ searchParams }: PageProps<"/[lang]/login">) {
  const { t, href } = await getI18n();
  return (
    <section className="mx-auto max-w-md px-4 py-14">
      <h1 className="mb-8 text-center text-3xl font-bold text-slate-900">
        <span className="text-brand-gradient">{t.login.title}</span>
      </h1>
      {/* searchParams is request data → read it behind Suspense (Cache Components). */}
      <Suspense fallback={<LoginForm />}>
        <LoginWithNext searchParams={searchParams} />
      </Suspense>
      <p className="mt-6 text-center text-sm text-slate-600">
        {t.login.noShop} <Link href={href("/signup")} className="font-semibold text-brand">{t.login.register}</Link>
      </p>
    </section>
  );
}

async function LoginWithNext({ searchParams }: Pick<PageProps<"/[lang]/login">, "searchParams">) {
  const { next } = await searchParams;
  return <LoginForm next={typeof next === "string" ? next : undefined} />;
}
