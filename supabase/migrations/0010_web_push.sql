-- ============================================================================
-- KurdBooking — 0010: browser push notifications (Web Push)
--
--   * push_subscriptions  one row per browser/device that turned alerts on
--   * push_keys           the site's VAPID key pair, made by the server on
--                         first use (lib/push.ts). Server only: no policies,
--                         no grants for anon/authenticated.
--
-- First use: you (super admin) get an alert for every new /signup order.
-- The table is per user, so owners can use it later (bookings) too.
-- ============================================================================

create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null unique check (endpoint like 'https://%' and char_length(endpoint) <= 1000),
  p256dh      text not null check (char_length(p256dh) <= 200),
  auth        text not null check (char_length(auth) <= 100),
  lang        text not null default 'ckb' check (lang in ('ckb', 'ar', 'en')),  -- language of the alert text
  user_agent  text check (char_length(user_agent) <= 300),
  created_at  timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

comment on table public.push_subscriptions is 'Browsers that turned on push alerts (Web Push)';

alter table public.push_subscriptions enable row level security;

create policy "push: own rows" on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.push_subscriptions from anon, authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;

create table public.push_keys (
  id          boolean primary key default true check (id),
  public_key  text not null,
  private_key text not null,
  created_at  timestamptz not null default now()
);

comment on table public.push_keys is 'VAPID key pair for Web Push. Read only by the server (secret key).';

alter table public.push_keys enable row level security;
revoke all on public.push_keys from anon, authenticated;
grant all on public.push_keys to service_role;
