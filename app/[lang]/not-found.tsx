import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t, f, href } = await getI18n();
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <p className="text-6xl font-bold text-brand">{f.num(404)}</p>
        <p className="mt-3 text-slate-600">{t.notFound.text}</p>
        <Link href={href("/")} className="btn-primary mt-6">{t.common.back}</Link>
      </div>
    </main>
  );
}
