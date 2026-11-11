"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPush } from "@/lib/push";
import { getActionI18n } from "@/lib/i18n/request";
import { DICTS } from "@/lib/i18n/dictionaries";
import { localePath } from "@/lib/i18n/config";
import { userMessage } from "@/lib/errors";
import type { ActionState } from "@/lib/fields";

// Saving this device for push alerts, for anyone logged in (shop owners,
// staff, the super admin). Who gets which alert is decided in lib/push.ts.
// Devices are saved with the secret key: the same browser/phone may have been
// saved under another login before, and it now belongs to whoever is logged in.

const webSchema = z.object({
  endpoint: z.string().url().startsWith("https://").max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

/** Browser push (Web Push). */
export async function savePushSubscription(subscription: unknown, userAgent: string): Promise<ActionState> {
  const { lang, t } = await getActionI18n();
  const user = await requireUser();
  const parsed = webSchema.safeParse(subscription);
  if (!parsed.success) return { ok: false, message: t.errors.invalidData };
  const { endpoint, keys } = parsed.data;
  const { error } = await createAdminClient().from("push_subscriptions").upsert(
    { user_id: user.id, kind: "web", platform: null, endpoint, p256dh: keys.p256dh, auth: keys.auth, lang, user_agent: String(userAgent).slice(0, 300) },
    { onConflict: "endpoint" },
  );
  if (error) return { ok: false, message: userMessage(error, lang) };
  return { ok: true };
}

/** The Android (later iOS) app's FCM token. */
export async function saveNativePushToken(token: string, platform: string): Promise<ActionState> {
  const { lang, t } = await getActionI18n();
  const user = await requireUser();
  const parsed = z
    .object({ token: z.string().regex(/^[A-Za-z0-9_:\-]+$/).max(1000), platform: z.enum(["android", "ios"]) })
    .safeParse({ token, platform });
  if (!parsed.success) return { ok: false, message: t.errors.invalidData };
  const { error } = await createAdminClient().from("push_subscriptions").upsert(
    { user_id: user.id, kind: "fcm", platform: parsed.data.platform, endpoint: parsed.data.token, p256dh: null, auth: null, lang, user_agent: null },
    { onConflict: "endpoint" },
  );
  if (error) return { ok: false, message: userMessage(error, lang) };
  return { ok: true };
}

/** Turn off this device (RLS: only your own rows). */
export async function removePushSubscription(endpoint: string): Promise<ActionState> {
  const { lang } = await getActionI18n();
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", String(endpoint).slice(0, 1000));
  if (error) return { ok: false, message: userMessage(error, lang) };
  return { ok: true };
}

/** A test alert to all of your devices. */
export async function sendTestPush(): Promise<ActionState> {
  const { t } = await getActionI18n();
  const user = await requireUser();
  const { sent } = await sendPush([user.id], (lang) => ({
    title: DICTS[lang].push.testTitle,
    body: DICTS[lang].push.testBody,
    url: localePath(lang, "/dashboard"),
    tag: "test",
  }));
  return sent ? { ok: true, message: t.push.testSent } : { ok: false, message: t.push.testFailed };
}
