-- ============================================================================
-- KurdBooking — 0013: customers' favourite shops
--
--   * favorite_shops   one row per (account, shop) the customer saved
--   * my_favorite_shops()   the logged-in customer's saved shops that are live
--
-- Rules:
--   * Each account reads, adds and removes only its own rows.
--   * Only a live shop can be added. A shop that closes later stays saved,
--     but my_favorite_shops() leaves it out until it is live again.
--   * Shops never see who saved them.
-- ============================================================================

create table public.favorite_shops (
  user_id    uuid not null references auth.users(id) on delete cascade,
  shop_id    uuid not null references public.shops(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, shop_id)
);
create index favorite_shops_shop_idx on public.favorite_shops (shop_id);

comment on table public.favorite_shops is 'Shops a customer account saved (heart on the shop page)';

alter table public.favorite_shops enable row level security;

create policy "favorites: own rows read" on public.favorite_shops for select to authenticated
  using (user_id = auth.uid());
create policy "favorites: own rows add" on public.favorite_shops for insert to authenticated
  with check (user_id = auth.uid() and public.shop_is_live(shop_id));
create policy "favorites: own rows remove" on public.favorite_shops for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.favorite_shops from anon, authenticated;
grant select, insert, delete on public.favorite_shops to authenticated;
grant all on public.favorite_shops to service_role;

-- The customer's saved shops, newest first, with what a shop card needs.
-- (security definer: customers can't read public.shops itself.)
create function public.my_favorite_shops()
returns table (
  id           uuid,
  slug         text,
  name         text,
  kind         text,
  tagline      text,
  logo_url     text,
  rating_avg   numeric,
  rating_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.slug, s.name, s.kind, p.tagline, p.logo_url,
         round(avg(r.rating)::numeric, 1), count(r.id)::int
  from public.favorite_shops f
  join public.shops s on s.id = f.shop_id
  left join public.shop_profile p on p.shop_id = s.id
  left join public.reviews r on r.shop_id = s.id and not r.is_hidden
  where auth.uid() is not null and f.user_id = auth.uid()
    and s.status in ('trial', 'active', 'past_due')
  group by s.id, p.shop_id, f.created_at
  order by f.created_at desc;
$$;

revoke execute on function public.my_favorite_shops() from public, anon;
grant execute on function public.my_favorite_shops() to authenticated;
