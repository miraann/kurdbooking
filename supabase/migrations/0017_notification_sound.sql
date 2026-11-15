-- Notification sound: each person picks the sound their phone plays for alerts in the
-- Android owner app (Dashboard → Settings). The valid ids match lib/notification-sounds.ts.
-- The server reads it when it sends a push, to choose the Android notification channel.
-- Browsers cannot choose a sound, so this only matters for app (FCM) devices.

alter table public.profiles
  add column notification_sound text not null default 'default'
  check (notification_sound in ('default', 'chime', 'bell', 'doorbell', 'alert'));

-- profiles: users may change their own name, phone and sound, never is_super_admin.
grant update (notification_sound) on public.profiles to authenticated;
