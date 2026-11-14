import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import type { Metadata } from "next";
import { getRecoveryUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { PasswordForm } from "@/components/forms/PasswordForm";

// Opened from a reset link through /auth/confirm, which logged the person in
// for the reset. Without a fresh reset session it only offers a new link.

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.password.resetTitle, robots: { index: false, follow: false } };
}

export default async function ResetPasswordPage() {
  const { t } = await getI18n();
  return (
    <section className="mx-auto max-w-md px-4 py-14">
      <h1 className="mb-3 text-center text-3xl font-bold text-slate-900">
        <span className="text-brand-gradient">{t.password.resetTitle}</span>
      </h1>
      {/* The session is in cookies (request data) → behind Suspense. */}
      <Suspense fallback={<div className="card h-72 animate-pulse" />}>
        <ResetBody />
      </Suspense>
    </section>
  );
}

async function ResetBody() {
  await connection(); // getRecoveryUser() checks the current time, so never prerender this part
  const [{ t, href }, user] = await Promise.all([getI18n(), getRecoveryUser()]);
  if (!user) {
    return (
      <div className="card mt-8 space-y-4 text-center">
        <p className="text-slate-600">{t.password.needLink}</p>
        <Link href={href("/forgot-password")} className="btn-primary">{t.password.forgotTitle}</Link>
      </div>
    );
  }
  return (
    <>
      <p className="mb-8 text-center text-slate-600">
        {t.password.resetFor} <span dir="ltr" className="font-semibold">{user.email}</span>
      </p>
      <PasswordForm mode="reset" email={user.email} />
    </>
  );
}
