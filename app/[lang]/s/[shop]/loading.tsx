import { getI18n } from "@/lib/i18n/server";

// Instant placeholder while a shop page streams in (also gives each page its
// own Suspense boundary, which Cache Components wants for URL data).
export default async function ShopLoading() {
  const { t } = await getI18n();
  return (
    <div className="flex animate-pulse flex-col items-center gap-5 px-5 pt-12" aria-busy="true" aria-label={t.common.loading}>
      <div className="size-52 rounded-full bg-neutral-100" />
      <div className="h-10 w-48 rounded-2xl bg-neutral-100" />
      <div className="h-14 w-full max-w-xs rounded-2xl bg-neutral-100" />
    </div>
  );
}
