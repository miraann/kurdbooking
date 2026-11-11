import { getI18n } from "@/lib/i18n/server";

/** Placeholder shown while a page's data streams in. */
export async function PageSkeleton() {
  const { t } = await getI18n();
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label={t.common.loading}>
      <div className="h-7 w-48 rounded-2xl bg-slate-200/70" />
      <div className="h-24 rounded-3xl bg-white shadow-md-1" />
      <div className="h-24 rounded-3xl bg-white shadow-md-1" />
      <div className="h-24 rounded-3xl bg-white shadow-md-1" />
    </div>
  );
}
