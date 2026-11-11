import "server-only";
import webpush from "web-push";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { isLang, type Lang } from "@/lib/i18n/config";

// One way to alert people, whatever their device. Each row of
// public.push_subscriptions is one device:
//   kind 'web'  browser push (Web Push): Chrome/Edge/Firefox on Android and
//               desktop, iPhone once the site is on the Home Screen
//   kind 'fcm'  the Android app (Firebase Cloud Messaging)
//
// Web Push keys live in public.push_keys (made on first use).
// FCM needs FIREBASE_SERVICE_ACCOUNT (the JSON key from Firebase → Project
// settings → Service accounts). Without it, app devices are skipped.

type Admin = ReturnType<typeof createAdminClient>;
export interface PushMessage { title: string; body: string; url: string; tag?: string }
interface Device { id: string; kind: "web" | "fcm"; endpoint: string; p256dh: string | null; auth: string | null; lang: string }

/** Android channel the app creates (components/push/native.ts). */
export const ANDROID_CHANNEL = "alerts";

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

let firebase: App | null | undefined;
function firebaseApp(): App | null {
  if (firebase !== undefined) return firebase;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    console.warn("FIREBASE_SERVICE_ACCOUNT is not set: app (FCM) devices get no push");
    return (firebase = null);
  }
  firebase = getApps()[0] ?? initializeApp({ credential: cert(JSON.parse(raw)) });
  return firebase;
}

/** Thrown error → true when the device is gone for good (delete its row). */
type Sent = { ok: true } | { ok: false; gone: boolean; reason: unknown };

async function sendWeb(d: Device, msg: PushMessage, admin: Admin): Promise<Sent> {
  const keys = await vapidKeys(admin);
  const site = env.siteUrl();
  try {
    await webpush.sendNotification(
      { endpoint: d.endpoint, keys: { p256dh: d.p256dh ?? "", auth: d.auth ?? "" } },
      JSON.stringify(msg),
      {
        vapidDetails: {
          subject: site.startsWith("https://") ? site : "mailto:push@localhost.invalid",
          publicKey: keys.public_key,
          privateKey: keys.private_key,
        },
        TTL: 24 * 60 * 60,
        urgency: "high",
      },
    );
    return { ok: true };
  } catch (e) {
    const status = (e as { statusCode?: number })?.statusCode;
    return { ok: false, gone: status === 404 || status === 410, reason: status ?? e };
  }
}

const FCM_GONE = ["messaging/registration-token-not-registered", "messaging/invalid-registration-token"];

async function sendFcm(d: Device, msg: PushMessage): Promise<Sent> {
  const app = firebaseApp();
  if (!app) return { ok: false, gone: false, reason: "no FIREBASE_SERVICE_ACCOUNT" };
  try {
    await getMessaging(app).send({
      token: d.endpoint,
      // A `notification` block: Android draws it even when the app is closed.
      notification: { title: msg.title, body: msg.body },
      data: { url: msg.url, ...(msg.tag ? { tag: msg.tag } : {}) },
      android: {
        priority: "high",
        notification: { channelId: ANDROID_CHANNEL, sound: "default", tag: msg.tag, visibility: "public" },
      },
    });
    return { ok: true };
  } catch (e) {
    const code = (e as { code?: string })?.code ?? "";
    return { ok: false, gone: FCM_GONE.includes(code), reason: code || e };
  }
}

/** Sends to every device of these users; deletes devices that are gone. */
export async function sendPush(userIds: string[], build: (lang: Lang) => PushMessage): Promise<{ sent: number; failed: number }> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return { sent: 0, failed: 0 };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("push_subscriptions")
    .select("id, kind, endpoint, p256dh, auth, lang")
    .in("user_id", ids);
  if (error) throw error;
  const devices = (data ?? []) as Device[];
  if (devices.length === 0) return { sent: 0, failed: 0 };

  const results = await Promise.all(
    devices.map((d) => {
      const msg = build(isLang(d.lang) ? d.lang : "ckb");
      return d.kind === "fcm" ? sendFcm(d, msg) : sendWeb(d, msg, admin);
    }),
  );

  const gone = devices.filter((_, i) => { const r = results[i]; return !r.ok && r.gone; }).map((d) => d.id);
  if (gone.length) await admin.from("push_subscriptions").delete().in("id", gone);
  results.forEach((r, i) => {
    if (!r.ok && !r.gone) console.error("push failed", devices[i].kind, String(r.reason));
  });

  const sent = results.filter((r) => r.ok).length;
  return { sent, failed: results.length - sent };
}

/** Alerts every super admin (e.g. a new /signup order). */
export async function notifySuperAdmins(build: (lang: Lang) => PushMessage) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("profiles").select("id").eq("is_super_admin", true);
  if (error) throw error;
  return sendPush((data ?? []).map((p) => p.id as string), build);
}

/**
 * Alerts a shop's owners and managers, plus the staff member the booking is
 * for when they have their own login. Always filtered by shop_id.
 */
export async function notifyShop(shopId: string, staffId: string | null, build: (lang: Lang) => PushMessage) {
  const admin = createAdminClient();
  const [{ data: members, error }, { data: staff }] = await Promise.all([
    admin.from("shop_members").select("user_id").eq("shop_id", shopId).in("role", ["owner", "manager"]),
    staffId
      ? admin.from("staff").select("user_id").eq("shop_id", shopId).eq("id", staffId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (error) throw error;
  const ids = (members ?? []).map((m) => m.user_id as string);
  if (staff?.user_id) ids.push(staff.user_id as string);
  return sendPush(ids, build);
}
