import type { Metadata } from "next";
import { getMapPins } from "@/lib/shop-data";
import { getI18n } from "@/lib/i18n/server";
import { ShopMap } from "@/components/map/ShopMap";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.mapPage.metaTitle };
}

// The «نەخشە» tab of the customer app: the listed shops' branches on a map of
// Sulaymaniyah. Public data (cached under the shop-list tag), so no session is read.
// data-map-page: the layout drops its footer and bottom padding for this page, and the map
// takes the whole screen between the header and the tab bar (the bar floats over its foot).
export default async function MapPage() {
  const pins = await getMapPins();
  return (
    <main
      data-map-page
      className="h-[calc(100dvh-4.2rem)] md:mx-auto md:my-6 md:h-[calc(100dvh-8.5rem)] md:max-w-5xl md:overflow-hidden md:rounded-3xl md:border md:border-neutral-200 md:shadow-md"
    >
      <ShopMap pins={pins} />
    </main>
  );
}
