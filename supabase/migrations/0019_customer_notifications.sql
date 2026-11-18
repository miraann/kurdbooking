-- ============================================================================
-- KurdBooking — 0019: the customer's notification inbox
--
--   * customer_notifications   one row per thing the customer was told: the shop
--                              confirmed / declined / cancelled / finished a
--                              booking, the day-before reminder, a time that
--                              opened on a waitlist day
--   * my_notifications()       the logged-in customer's list, newest first, with
--                              what a row needs to be drawn and opened
--
-- Why: pushes are fire and forget, and the customer app (a WebView) can't get
-- web push at all. The inbox is the «ئاگادارکردنەوە» tab of the app: it works
-- with no push device, and keeps what the customer missed.
--
-- Rules:
--   * Only the server (secret key) writes rows, when it sends the push.
--   * Each account reads its own rows, marks them read (read_at, nothing else
--     can change) and deletes them. Shops never see these rows.
--   * Text is not stored: the page builds it from kind + the booking, in the
--     language the customer is using.
-- ============================================================================

create table public.customer_notifications (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  shop_id        uuid not null references public.shops(id) on delete cascade,
  kind           text not null check (kind in ('confirmed', 'declined', 'cancelled', 'completed', 'reminder', 'waitlist')),
  -- booking events point at the booking; a waitlist alert at the day (and service) waited for
  appointment_id uuid references public.appointments(id) on delete cascade,
  for_date       date,
  service_id     uuid references public.services(id) on delete set null,
  read_at        timestamptz,
  created_at     timestamptz not null default now(),
  constraint customer_notifications_target check (
    (kind = 'waitlist' and for_date is not null and appointment_id is null)
    or (kind <> 'waitlist' and appointment_id is not null)
  )
);
create index customer_notifications_user_idx on public.customer_notifications (user_id, created_at desc);
create index customer_notifications_shop_idx on public.customer_notifications (shop_id);
-- A booking is reminded once, even if the daily job runs twice.
create unique index customer_notifications_one_reminder on public.customer_notifications (appointment_id) where kind = 'reminder';

comment on table public.customer_notifications is 'A customer''s inbox: booking updates, reminders and waitlist alerts (written by the server when it sends the push)';

alter table public.customer_notifications enable row level security;

create policy "notifications: own rows read" on public.customer_notifications for select to authenticated
  using (user_id = auth.uid());
create policy "notifications: own rows mark read" on public.customer_notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications: own rows remove" on public.customer_notifications for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.customer_notifications from anon, authenticated;
grant select, delete on public.customer_notifications to authenticated;
grant update (read_at) on public.customer_notifications to authenticated;
grant all on public.customer_notifications to service_role;

-- The customer's inbox, newest first.
-- (security definer: customers can't read shops, shop_profile or appointments themselves.)
create function public.my_notifications(p_limit integer default 50)
returns table (
  id             uuid,
  kind           text,
  created_at     timestamptz,
  read_at        timestamptz,
  shop_slug      text,
  shop_name      text,
  shop_logo_url  text,
  appointment_id uuid,
  public_token   uuid,
  service_name   text,
  starts_at      timestamptz,
  for_date       date,
  service_id     uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  select n.id, n.kind, n.created_at, n.read_at, s.slug, s.name, p.logo_url,
         n.appointment_id, a.public_token, a.service_name, a.starts_at, n.for_date, n.service_id
  from public.customer_notifications n
  join public.shops s on s.id = n.shop_id
  left join public.shop_profile p on p.shop_id = s.id
  left join public.appointments a on a.id = n.appointment_id
  where auth.uid() is not null and n.user_id = auth.uid()
  order by n.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

revoke execute on function public.my_notifications(integer) from public, anon;
grant execute on function public.my_notifications(integer) to authenticated;
