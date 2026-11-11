import { Suspense } from "react";
import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import { LoginForm } from "@/app/[lang]/(platform)/login/LoginForm";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";

// The super admin's own login. It sits outside super/(panel), so it isn't
// behind the admin check, and it refuses shop accounts (auth-actions.ts).

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.login.adminTitle, robots: { index: false, follow: false } };
}

export default async function SuperLoginPage({ searchParams }: PageProps<"/[lang]/super/login">) {
  const { t } = await getI18n();
  return (
    <div className="min-h-dvh bg-surface">
      <div className="mx-auto flex max-w-md justify-end px-4 pt-4">
        <LanguageSwitcher />
      </div>
      <section className="mx-auto max-w-md px-4 py-10">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-4 grid size-14 place-items-center rounded-3xl bg-brand text-white shadow-md-1">
            <ShieldCheck className="size-7" aria-hidden />
          </span>
          <p className="text-lg font-bold text-slate-900" dir="ltr">
            Kurd<span className="text-brand-gradient">Booking</span>
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{t.login.adminTitle}</h1>
        </div>
        {/* searchParams is request data → read it behind Suspense (Cache Components). */}
        <Suspense fallback={<LoginForm admin />}>
          <LoginWithNext searchParams={searchParams} />
        </Suspense>
      </section>
    </div>
  );
}

async function LoginWithNext({ searchParams }: Pick<PageProps<"/[lang]/super/login">, "searchParams">) {
  const { next } = await searchParams;
  return <LoginForm admin next={typeof next === "string" ? next : undefined} />;
}
