"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Music, Play } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { saveNotificationSound } from "@/app/[lang]/push-actions";
import { NOTIFICATION_SOUNDS, soundPreviewUrl, type NotificationSoundId } from "@/lib/notification-sounds";
import { isNativeApp } from "./native";

/**
 * Dashboard → Settings, inside the Android app only (browsers can't choose an alert sound):
 * pick the sound your alerts play. Tapping a sound plays it and saves it.
 */
export function SoundCard({ initial }: { initial: NotificationSoundId }) {
  const { lang, t } = useI18n();
  const s = t.push.sound;
  const app = useSyncExternalStore(() => () => {}, isNativeApp, () => false); // false on the server and while hydrating
  const [sound, setSound] = useState(initial);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const el = audio;
    return () => el.current?.pause();
  }, []);

  if (!app) return null;

  function preview(id: NotificationSoundId) {
    audio.current?.pause();
    const url = soundPreviewUrl(id);
    if (!url) return;
    audio.current = new Audio(url);
    audio.current.play().catch(() => {});
  }

  async function pick(id: NotificationSoundId) {
    preview(id);
    if (id === sound || busy) return;
    const before = sound;
    setSound(id);
    setBusy(true);
    setMessage("");
    const r = await saveNotificationSound(id).catch(() => null);
    if (!r?.ok) setSound(before);
    setMessage(r?.ok ? s.saved : r?.message || s.failed);
    setBusy(false);
  }

  return (
    <section className="card space-y-4">
      <div className="flex items-center gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
          <Music className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold">{s.title}</h2>
          <p className="text-sm text-slate-600">{s.help}</p>
        </div>
      </div>

      <div role="radiogroup" aria-label={s.title} className="space-y-2">
        {NOTIFICATION_SOUNDS.map((o) => {
          const active = o.id === sound;
          return (
            <div key={o.id} className={`flex items-center rounded-2xl border ${active ? "border-indigo-500 bg-indigo-50/50" : "border-slate-200"}`}>
              <button type="button" role="radio" aria-checked={active} onClick={() => pick(o.id)} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-start">
                <span className={`grid size-5 shrink-0 place-items-center rounded-full border-2 ${active ? "border-indigo-600" : "border-slate-300"}`}>
                  {active && <span className="size-2 rounded-full bg-indigo-600" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{o.label[lang]}</span>
                  <span className="block text-xs text-slate-500">{o.description[lang]}</span>
                </span>
              </button>
              {soundPreviewUrl(o.id) && (
                <button type="button" aria-label={s.listen.replace("{name}", o.label[lang])} onClick={() => preview(o.id)} className="me-1 grid size-10 shrink-0 place-items-center rounded-full text-slate-500 active:bg-slate-100">
                  <Play className="size-4" aria-hidden />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="min-h-5 text-sm text-indigo-700" aria-live="polite">{message}</p>
      <p className="text-xs text-slate-500">{s.newApp}</p>
    </section>
  );
}
