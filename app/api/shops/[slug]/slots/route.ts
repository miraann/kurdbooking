import { NextResponse, type NextRequest } from "next/server";
import { getPublicShop, getShopContent, isValidSlug } from "@/lib/shop-data";
import { eligibleStaff, getAvailability, mergeSlots } from "@/lib/availability.server";
import { isDateKey } from "@/lib/booking";

// GET /api/shops/<slug>/slots?service=<id>&staff=<id|any>&date=YYYY-MM-DD
// → { slots: ["10:00", "10:30", …] }   (shop-local times)
// Public on purpose: the booking page (and later the native apps) call it.
export async function GET(request: NextRequest, ctx: RouteContext<"/api/shops/[slug]/slots">) {
  const { slug } = await ctx.params;
  const q = request.nextUrl.searchParams;
  const serviceId = q.get("service") ?? "";
  const staffId = q.get("staff") ?? "any";
  const date = q.get("date") ?? "";

  if (!isValidSlug(slug) || !isDateKey(date) || !serviceId) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const shop = await getPublicShop(slug);
  if (!shop?.is_live) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const content = await getShopContent(shop.id);
  const service = content.services.find((s) => s.id === serviceId);
  if (!service || !content.profile?.booking_enabled) return NextResponse.json({ slots: [] });

  let staff = eligibleStaff(content.staff, content.staffServices, service.id);
  if (staffId !== "any") staff = staff.filter((s) => s.id === staffId);

  const byStaff = await getAvailability({
    shopId: shop.id,
    timeZone: shop.timezone,
    profile: content.profile,
    service,
    staff,
    dateKey: date,
  });

  return NextResponse.json({ slots: mergeSlots(byStaff) }, { headers: { "Cache-Control": "no-store" } });
}
