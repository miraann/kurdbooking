-- ============================================================================
-- KurdBooking — 0009: shop orders from /signup
--
-- Only you (super admin) create shops now, in /super/shops/new. The public
-- /signup page is an order form: it saves a row here and nothing else (no
-- account, no shop). You call the owner, then create the shop from the order.
--
-- Rules:
--   * Visitors never touch this table directly: the server writes the order
--     with the secret key (after its honeypot and duplicate checks).
--   * Only you read, update and delete orders.
-- ============================================================================

create table public.shop_requests (
  id          uuid primary key default gen_random_uuid(),
  shop_name   text not null check (char_length(btrim(shop_name)) between 2 and 80),
  kind        text not null default 'barber' check (kind in ('barber', 'salon', 'both')),
  owner_name  text not null check (char_length(btrim(owner_name)) between 2 and 80),
  phone       text not null check (char_length(phone) between 7 and 20),
  city        text check (char_length(city) <= 60),
  note        text check (char_length(note) <= 500),
  status      text not null default 'new' check (status in ('new', 'done', 'rejected')),
  shop_id     uuid references public.shops(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index shop_requests_status_idx on public.shop_requests (status, created_at desc);
create index shop_requests_phone_idx on public.shop_requests (phone, created_at desc);

comment on table public.shop_requests is 'Orders sent from /signup; you turn them into shops in /super';

alter table public.shop_requests enable row level security;

create policy "shop requests: super reads" on public.shop_requests for select to authenticated
  using (public.is_super_admin());
create policy "shop requests: super updates" on public.shop_requests for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
create policy "shop requests: super deletes" on public.shop_requests for delete to authenticated
  using (public.is_super_admin());

revoke all on public.shop_requests from anon, authenticated;
grant select, update, delete on public.shop_requests to authenticated;
grant all on public.shop_requests to service_role;

-- Shops are created only by the server for you (create_shop_for_owner stays
-- service_role only, see 0004).
comment on function public.create_shop_for_owner(uuid, text, text, text, text, text)
  is 'Creates a shop with defaults. Called only by the server from /super/shops/new.';
