import { getI18n } from "@/lib/i18n/server";

// Own Suspense boundary: the profile reads the session (Cache Components).
export default async function AccountLoading() {
  const { t } = await getI18n();
  return (
    <div className="mx-auto max-w-md animate-pulse px-5 pt-12" aria-busy="true" aria-label={t.common.loading}>
      <div className="mx-auto h-12 w-56 rounded-2xl bg-neutral-100" />
      <div className="mt-8 h-24 rounded-3xl bg-neutral-100" />
      <div className="mt-10 space-y-3">
        {[0, 1].map((i) => <div key={i} className="h-24 rounded-3xl bg-neutral-100" />)}
      </div>
    </div>
  );
}
