import { getI18n } from "@/lib/i18n/server";

// Instant placeholder while the shop list streams in (the filter and search come
// from the URL, so the page needs its own Suspense boundary).
export default async function ShopsLoading() {
  const { t } = await getI18n();
  return (
    <div className="mx-auto max-w-5xl animate-pulse px-5 pt-12" aria-busy="true" aria-label={t.common.loading}>
      <div className="mx-auto h-12 w-64 rounded-2xl bg-neutral-100" />
      <div className="mx-auto mt-8 h-14 max-w-xl rounded-2xl bg-neutral-100" />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-72 rounded-3xl bg-neutral-100" />)}
      </div>
    </div>
  );
}
