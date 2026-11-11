import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import { DASHBOARD_LINKS } from "@/components/dashboard/links";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";

// Phone «زیاتر» tab: every section that doesn't fit in the tab bar, plus the
// language picker (the desktop sidebar has its own).
export default async function MorePage() {
  const { lang, t, href } = await getI18n();
  return (
    <div className="space-y-4">
      <h1 className="page-title">{t.dashboard.more.title}</h1>
      <ul className="card divide-y divide-slate-100 p-2">
        {DASHBOARD_LINKS.filter((l) => !l.tab).map(({ href: to, label, icon: Icon }) => (
          <li key={to}>
            <Link href={href(to)} className="flex items-center gap-3 rounded-2xl px-3 py-3.5 active:bg-slate-50">
              <span className="grid size-10 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="flex-1 font-bold text-slate-700">{label[lang]}</span>
              {/* Points "forward": left in RTL, right in LTR. */}
              <ChevronLeft className="size-5 text-slate-300 ltr:rotate-180" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <div className="card flex items-center justify-between gap-3 py-3">
        <span className="font-bold text-slate-700">{t.common.language}</span>
        <LanguageSwitcher />
      </div>
    </div>
  );
}
