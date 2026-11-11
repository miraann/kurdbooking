import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { isLang, type Lang } from "@/lib/i18n/config";

// Browser push (Web Push) — works in Chrome/Edge/Firefox on Android and
// desktop, and on iPhone once the site is added to the Home Screen.
//
// The VAPID key pair lives in public.push_keys (server only). It is made on
// first use, so there is nothing to set up in Vercel.

type Admin = ReturnType<typeof createAdminClient>;
export interface PushMessage { title: string; body: string; url: string; tag?: string }

async function vapidKeys(admin: Admin): Promise<{ public_key: string; private_key: string }> {
  const read = () => admin.from("push_keys").select("public_key, private_key").eq("id", true).maybeSingle();
  const { data, error } = await read();
  if (error) throw error;
  if (data) return data;
  const keys = webpush.generateVAPIDKeys();
  // Two requests at once: the second insert is ignored, both read the winner.
  await admin.from("push_keys").upsert({ id: true, public_key: keys.publicKey, private_key: keys.privateKey }, { onConflict: "id", ignoreDuplicates: true });
  const again = await read();
  if (again.error || !again.data) throw again.error ?? new Error("push_keys missing");
  return again.data;
}

/** The public half, for pushManager.subscribe() in the browser. */
export async function pushPublicKey(): Promise<string> {
  return (await vapidKeys(createAdminClient())).public_key;
}

/** Sends to every saved browser of these users; drops browsers that are gone. */
export async function sendPush(userIds: string[], build: (lang: Lang) => PushMessage): Promise<{ sent: number; failed: number }> {
  if (userIds.length === 0) return { sent: 0, failed: 0 };
  const admin = createAdminClient();
  const [{ data: subs, error }, keys] = await Promise.all([
    admin.from("push_subscriptions").select("id, endpoint, p256dh, auth, lang").in("user_id", userIds),
    vapidKeys(admin),
  ]);
  if (error) throw error;
  if (!subs?.length) return { sent: 0, failed: 0 };

  const site = env.siteUrl();
  const vapid = {
    subject: site.startsWith("https://") ? site : "mailto:push@localhost.invalid",
    publicKey: keys.public_key,
    privateKey: keys.private_key,
  };

  const gone: string[] = [];
  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush
        .sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(build(isLang(s.lang) ? s.lang : "ckb")),
          { vapidDetails: vapid, TTL: 24 * 60 * 60, urgency: "high" },
        )
        .catch((e: { statusCode?: number }) => {
          // 404/410: the browser unsubscribed or was reset.
          if (e?.statusCode === 404 || e?.statusCode === 410) gone.push(s.id);
          throw e;
        }),
    ),
  );
  if (gone.length) await admin.from("push_subscriptions").delete().in("id", gone);

  const failed = results.filter((r) => r.status === "rejected");
  failed.forEach((r) => console.error("web push failed", (r as PromiseRejectedResult).reason?.statusCode ?? (r as PromiseRejectedResult).reason));
  return { sent: results.length - failed.length, failed: failed.length };
}

/** Alerts every super admin (e.g. a new /signup order). */
export async function notifySuperAdmins(build: (lang: Lang) => PushMessage) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("profiles").select("id").eq("is_super_admin", true);
  if (error) throw error;
  return sendPush((data ?? []).map((p) => p.id as string), build);
}
