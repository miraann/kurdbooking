-- ============================================================================
-- KurdBooking — 0003: customers and appointments
-- Customer data (names, phones) is never readable with the public key:
-- bookings are written by the server (secret key) after it re-checks the
-- slot, and only the shop's own members can read them (0005).
-- ============================================================================

create table public.customers (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops(id) on delete cascade,
  full_name  text not null check (char_length(btrim(full_name)) between 1 and 80),
  phone      text not null check (phone ~ '^\+?[0-9]{7,15}$'),
  notes      text,                     -- the shop's private notes
  created_at timestamptz not null default now(),
  unique (shop_id, phone),
  unique (shop_id, id)
);

create table public.appointments (
  id               uuid primary key default gen_random_uuid(),
  shop_id          uuid not null references public.shops(id) on delete cascade,
  customer_id      uuid not null,
  staff_id         uuid not null,
  service_id       uuid,
  location_id      uuid references public.locations(id) on delete set null,
  -- Snapshot of the service at booking time, so history survives edits/deletes.
  service_name     text,
  duration_minutes integer not null check (duration_minutes between 5 and 600),
  price_iqd        integer check (price_iqd >= 0),
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  status           text not null default 'pending'
                   check (status in ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
  customer_note    text check (customer_note is null or char_length(customer_note) <= 500),
  -- Secret in the customer's receipt link (/appointment/<id>?t=<token>).
  public_token     uuid not null default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (ends_at > starts_at),
  foreign key (shop_id, customer_id) references public.customers (shop_id, id) on delete cascade,
  foreign key (shop_id, staff_id)    references public.staff (shop_id, id)     on delete restrict,
  foreign key (shop_id, service_id)  references public.services (shop_id, id)  on delete set null (service_id),
  -- One staff member can't have two live bookings that overlap. This is the
  -- final guard against two customers grabbing the same slot at once.
  constraint appointments_no_overlap exclude using gist (
    staff_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('pending', 'confirmed'))
);
create index appointments_shop_time_idx on public.appointments (shop_id, starts_at);
create index appointments_customer_idx  on public.appointments (customer_id);

-- ── updated_at bookkeeping ──────────────────────────────────────────────────
create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger appointments_touch before update on public.appointments
  for each row execute function public.touch_updated_at();
create trigger shops_touch before update on public.shops
  for each row execute function public.touch_updated_at();
create trigger shop_profile_touch before update on public.shop_profile
  for each row execute function public.touch_updated_at();
