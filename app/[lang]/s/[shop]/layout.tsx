import { Suspense } from "react";
import { ShopFrame } from "@/components/shop/ShopFrame";

// Public shop site. Reached at /s/<slug>, or at <slug>.<root-domain> through
// proxy.ts. The shop is looked up from the URL (request data), so everything
// streams inside Suspense; the lookups themselves are cached (lib/shop-data.ts).
export default function ShopLayout({ children, params }: LayoutProps<"/[lang]/s/[shop]">) {
  return (
    <Suspense fallback={<div className="min-h-dvh animate-pulse bg-white" />}>
      <ShopFrame params={params}>{children}</ShopFrame>
    </Suspense>
  );
}
