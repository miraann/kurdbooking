-- ============================================================================
-- KurdBooking — 0011: native app push (FCM) next to browser push
--
-- push_subscriptions (0010) now holds both kinds:
--   kind = 'web'  endpoint = the browser's push URL, with p256dh + auth keys
--   kind = 'fcm'  endpoint = the Android app's FCM device token
-- lib/push.ts sends to every row of the users it alerts, whatever the kind.
-- (iOS will be 'fcm' too, through Firebase, once there is an Apple account.)
-- ============================================================================

alter table public.push_subscriptions
  add column kind text not null default 'web' check (kind in ('web', 'fcm')),
  add column platform text check (platform in ('android', 'ios'));

alter table public.push_subscriptions
  alter column p256dh drop not null,
  alter column auth drop not null,
  drop constraint push_subscriptions_endpoint_check;

alter table public.push_subscriptions
  add constraint push_subscriptions_endpoint_check check (
    char_length(endpoint) <= 1000 and (
      (kind = 'web' and endpoint like 'https://%' and p256dh is not null and auth is not null)
      or (kind = 'fcm' and endpoint ~ '^[A-Za-z0-9_:\-]+$' and platform is not null)
    )
  );

comment on column public.push_subscriptions.endpoint is 'web: the browser push URL; fcm: the app''s FCM device token';
comment on table public.device_tokens is 'Unused: native tokens live in push_subscriptions (kind = fcm) since 0011';
