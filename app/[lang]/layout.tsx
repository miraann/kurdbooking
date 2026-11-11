import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { lang as rootLang } from "next/root-params";
import "../globals.css";
import { dirOf, isLang, LOCALES } from "@/lib/i18n/config";
import { DICTS } from "@/lib/i18n/dictionaries";
import { getI18n } from "@/lib/i18n/server";
import { I18nProvider } from "@/components/i18n/I18nProvider";

// One root layout per language (ckb, ar, en), all prerendered. proxy.ts maps
// clean Kurdish URLs to /ckb/… so every page is under this [lang] segment.
export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: { default: t.meta.title, template: "%s | KurdBooking" },
    description: t.meta.description,
    applicationName: "KurdBooking",
  };
}

export const viewport: Viewport = {
  themeColor: "#fafafc",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Static on purpose: the language comes from the URL, and there are no
// cookies/headers here, so every page gets an instant shell. Runtime data
// lives inside <Suspense> in each section's layout.
export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  const lang = await rootLang();
  if (!isLang(lang)) notFound();

  return (
    <html lang={lang} dir={dirOf(lang)} data-scroll-behavior="smooth" className="h-full antialiased">
      <body className="min-h-full">
        <I18nProvider lang={lang} dict={DICTS[lang]}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
