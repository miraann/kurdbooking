import Link from "next/link";
import { connection } from "next/server";
import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/customer";
import { getI18n } from "@/lib/i18n/server";
import { Heading } from "@/components/shop/theme";
import { MarkSeen } from "./MarkSeen";
import { NotificationRow, type Notification } from "./NotificationRow";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.notificationsPage.metaTitle, robots: { index: false } };
}

// The «ئاگادارکردنەوە» tab of the customer app: what the shops told the customer
// about their bookings (0019 inbox), newest first. It works without push, which a
// WebView app can't receive. Opening it marks everything read (MarkSeen).
// Reads the session, so it streams inside loading.tsx's Suspense boundary.

export default async function NotificationsPage() {
  await connection(); // the session check compares token expiry with the current time: never prerender
  const [viewer, { t, href }] = await Promise.all([getViewer(), getI18n()]);
  const p = t.notificationsPage;

  if (viewer.kind === "guest") {
    return (
      <main className="mx-auto max-w-md px-5 pt-12">
        <Heading as="h1" eyebrow="NOTIFICATIONS" title={p.title} />
        <div className="card-shop space-y-4 py-8 text-center">
          <Bell className="mx-auto size-10" style={{ color: "var(--shop-primary)" }} aria-hidden />
          <p className="text-neutral-600">{p.guestText}</p>
          <Link href={href("/account?next=/notifications")} className="btn-shop">{t.customerNav.signIn}</Link>
        </div>
      </main>
    );
  }

  if (viewer.kind === "staff") {
    return (
      <main className="mx-auto max-w-md px-5 pt-12">
        <div className="card-shop space-y-4 text-center">
          <p className="text-neutral-600">{t.account.staffAccount}</p>
          <Link href={href("/dashboard")} className="btn-shop">{t.account.toDashboard}</Link>
        </div>
      </main>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase.rpc("my_notifications", { p_limit: 50 });
  const rows = (data ?? []) as Notification[];

  return (
    <main className="mx-auto max-w-2xl px-5 pt-12">
      <Heading as="h1" eyebrow="NOTIFICATIONS" title={p.title}>
        <p className="mx-auto mt-4 max-w-md text-balance text-[0.95rem] font-medium leading-relaxed text-neutral-500">{p.subtitle}</p>
      </Heading>
      <MarkSeen hasUnread={rows.some((r) => !r.read_at)} />

      {rows.length === 0 ? (
        <div className="card-shop mx-auto max-w-md space-y-3 py-10 text-center">
          <Bell className="mx-auto size-10 text-neutral-300" aria-hidden />
          <p className="font-bold text-neutral-800">{p.empty}</p>
          <p className="text-sm text-neutral-500">{p.emptyHelp}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((n) => (
            <li key={n.id}>
              <NotificationRow n={n} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
