-- ============================================================================
-- KurdBooking — 0020: shops on the map
--
--   * map_shops()   one row per branch with a pin (lat + lng) of every shop the
--                   customer app lists: live, listed by the owner, not hidden
--                   by the super admin (same rule as listed_shops())
--
-- The «نەخشە» tab of the customer app draws these rows as pins. Anyone may call
-- it (the shop list is public too). It returns only what a pin card shows:
-- no phone numbers, no Google Maps links, nothing about the shop's owner.
-- A branch without coordinates is simply not on the map.
-- ============================================================================

create function public.map_shops()
returns table (
  shop_id       uuid,
  slug          text,
  name          text,
  kind          text,
  logo_url      text,
  rating_avg    numeric,
  rating_count  integer,
  location_id   uuid,
  location_name text,
  address       text,
  city          text,
  lat           double precision,
  lng           double precision
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.slug, s.name, s.kind, p.logo_url,
         rt.avg, rt.cnt,
         l.id, l.name, l.address, l.city, l.lat, l.lng
  from public.shops s
  join public.locations l on l.shop_id = s.id and l.lat is not null and l.lng is not null
  left join public.shop_profile p on p.shop_id = s.id
  left join lateral (
    select round(avg(r.rating)::numeric, 1) as avg, count(r.id)::int as cnt
    from public.reviews r
    where r.shop_id = s.id and not r.is_hidden
  ) rt on true
  where s.status in ('trial', 'active', 'past_due')
    and s.listed and not s.hidden_by_admin
  order by s.name, l.sort_order, l.created_at
  limit 500;
$$;

revoke execute on function public.map_shops() from public;
grant execute on function public.map_shops() to anon, authenticated;
