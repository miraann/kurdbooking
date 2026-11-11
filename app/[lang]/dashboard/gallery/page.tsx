import { getI18n } from "@/lib/i18n/server";
import { ResourceEditor } from "@/components/dashboard/ResourceEditor";

export default async function GalleryPage() {
  const { t } = await getI18n();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">{t.dashboard.gallery.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{t.dashboard.gallery.help}</p>
      </div>
      <ResourceEditor resource="gallery" />
    </div>
  );
}
