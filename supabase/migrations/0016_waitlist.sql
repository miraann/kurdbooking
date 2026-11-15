-- ============================================================================
-- KurdBooking — 0016: waitlist
--
-- A customer whose day is full joins that day's waitlist at a shop (optional
-- service and staff member). When a booking for that day is cancelled, the
-- server pushes everyone waiting; the first to book gets the time (nothing is
-- held). Booking that day, or leaving, removes the row; the daily job
-- removes past days.
--
-- Rules:
--   * A customer reads, adds and removes only their own rows, for a live
--     shop and a day that hasn't passed. One row per customer, shop and day.
--   * Shop members read their shop's rows (how many wait for which day).
--   * Only the server changes notified_at (secret key).
-- ============================================================================

create table public.waitlist (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null,
  service_id  uuid,
  staff_id    uuid,
  notified_at timestamptz,
  created_at  timestamptz not null default now(),
  foreign key (shop_id, service_id) references public.services (shop_id, id) on delete set null (service_id),
  foreign key (shop_id, staff_id)   references public.staff (shop_id, id)    on delete set null (staff_id),
  unique (user_id, shop_id, date)
);
create index waitlist_shop_date_idx on public.waitlist (shop_id, date);

comment on table public.waitlist is 'Customers waiting for a time to open on a full day';

alter table public.waitlist enable row level security;

create policy "waitlist: own or members read" on public.waitlist for select to authenticated
  using (user_id = auth.uid() or public.is_shop_member(shop_id) or public.is_super_admin());
create policy "waitlist: own rows add" on public.waitlist for insert to authenticated
  with check (user_id = auth.uid() and notified_at is null and public.shop_is_live(shop_id) and date >= current_date - 1);
create policy "waitlist: own rows remove" on public.waitlist for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.waitlist from anon, authenticated;
grant select, insert, delete on public.waitlist to authenticated;
grant all on public.waitlist to service_role;

-- The customer's waitlist entries for days that haven't passed, with names.
-- (security definer: customers can't read public.shops itself.)
create function public.my_waitlist()
returns table (
  id            uuid,
  shop_slug     text,
  shop_name     text,
  shop_logo_url text,
  date          date,
  service_id    uuid,
  service_name  text,
  staff_name    text
)
language sql
stable
security definer
set search_path = ''
as $$
  select w.id, s.slug, s.name, p.logo_url, w.date, w.service_id, sv.name, st.name
  from public.waitlist w
  join public.shops s on s.id = w.shop_id
  left join public.shop_profile p on p.shop_id = w.shop_id
  left join public.services sv on sv.shop_id = w.shop_id and sv.id = w.service_id
  left join public.staff st on st.shop_id = w.shop_id and st.id = w.staff_id
  where auth.uid() is not null and w.user_id = auth.uid()
    and w.date >= current_date - 1
    and s.status in ('trial', 'active', 'past_due')
  order by w.date, s.name;
$$;

revoke execute on function public.my_waitlist() from public, anon;
grant execute on function public.my_waitlist() to authenticated;
