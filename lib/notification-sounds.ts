// Sounds a person can pick for alerts in the Android owner app (Dashboard → Settings).
//
// Android 8+ fixes a notification channel's sound when the channel is created, so every
// sound has its own channel (components/push/native.ts creates them all) and the server
// posts to the one matching profiles.notification_sound (lib/push.ts). The custom sounds
// live in the APK (native/mobile/android/app/src/main/res/raw) and, for the preview in the
// page, in public/sounds. Both are made by `npm run sounds` (scripts/generate-notification-sounds.mjs).

export const NOTIFICATION_SOUNDS = [
  { id: "default", label: { ckb: "دەنگی سیستەم", ar: "صوت النظام", en: "Phone default" }, description: { ckb: "دەنگی بنەڕەتی ئاگادارکردنەوەی مۆبایلەکە", ar: "الصوت الافتراضي لإشعارات الهاتف", en: "The phone's own alert sound" } },
  { id: "chime", label: { ckb: "زەنگۆڵە", ar: "رنين ناعم", en: "Chime" }, description: { ckb: "دوو نۆتی نەرم و ئارام", ar: "نغمتان هادئتان", en: "Two soft notes" } },
  { id: "bell", label: { ckb: "زەنگ", ar: "جرس", en: "Bell" }, description: { ckb: "یەک لێدانی زەنگی ڕوون", ar: "ضربة جرس واضحة", en: "One clear bell strike" } },
  { id: "doorbell", label: { ckb: "زەنگی دەرگا", ar: "جرس الباب", en: "Doorbell" }, description: { ckb: "دینگ-دۆنگی ناسراو", ar: "رنين «دينغ-دونغ» المعروف", en: "The familiar ding-dong" } },
  { id: "alert", label: { ckb: "ئاگاداری بەهێز", ar: "تنبيه قوي", en: "Loud alert" }, description: { ckb: "ئاوازێکی خێرا و بەرز بۆ کاتی قەرەباڵغی", ar: "نغمة سريعة وعالية لأوقات الازدحام", en: "A quick, loud tune for busy times" } },
] as const;

export type NotificationSoundId = (typeof NOTIFICATION_SOUNDS)[number]["id"];

export const DEFAULT_NOTIFICATION_SOUND: NotificationSoundId = "default";

export function isNotificationSound(v: unknown): v is NotificationSoundId {
  return NOTIFICATION_SOUNDS.some((s) => s.id === v);
}

/** Android channel for a sound. "default" keeps the original channel, so installed apps still work. */
export function soundChannelId(id: NotificationSoundId): string {
  return id === "default" ? "alerts" : `alerts_${id}`;
}

/** res/raw resource name; null = the phone's own sound. */
export function soundResource(id: NotificationSoundId): string | null {
  return id === "default" ? null : `notify_${id}`;
}

export function soundPreviewUrl(id: NotificationSoundId): string | null {
  const res = soundResource(id);
  return res ? `/sounds/${res}.wav` : null;
}
