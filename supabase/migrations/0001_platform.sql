-- ============================================================================
-- KurdBooking — 0001: platform tables (Side 1: the seller platform)
--   platform_settings, profiles, plans, shops, shop_members, payments
--   + the helper functions every RLS policy uses.
-- Run the migrations in order (0001 → 0006) in the Supabase SQL editor,
-- or with `supabase db push`.
-- ============================================================================

create extension if not exists btree_gist;   -- exclusion constraint on appointments (0003)

-- ── Platform settings (one row) ─────────────────────────────────────────────
create table public.platform_settings (
  id               boolean primary key default true check (id),
  trial_days       integer not null default 14 check (trial_days between 0 and 365),
  grace_days       integer not null default 5  check (grace_days between 0 and 60),
  support_whatsapp text,
  updated_at       timestamptz not null default now()
);
insert into public.platform_settings (id) values (true) on conflict do nothing;

-- ── Profiles (one per auth user) ────────────────────────────────────────────
create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  full_name      text not null default '',
  phone          text,
  is_super_admin boolean not null default false,
  created_at     timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Plans (you create these in /super/plans) ────────────────────────────────
create table public.plans (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null check (char_length(btrim(name)) between 1 and 60),
  description        text,
  price_iqd          integer not null default 0 check (price_iqd >= 0),
  period_months      integer not null default 1 check (period_months between 1 and 36),
  max_staff          integer check (max_staff > 0),            -- null = unlimited
  max_gallery_photos integer check (max_gallery_photos > 0),   -- null = unlimited
  max_locations      integer check (max_locations > 0),        -- null = unlimited
  is_public          boolean not null default true,            -- shown on /pricing
  sort_order         integer not null default 0,
  created_at         timestamptz not null default now()
);

-- ── Shops (tenants) ─────────────────────────────────────────────────────────
-- Subscription state lives on the shop row: status + trial_ends_at + paid_until.
-- payments (below) is the history. refresh_shop_statuses() (0004) moves shops
-- trial → past_due → suspended; record_payment() (0004) makes them active.
create table public.shops (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique
                check (slug ~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$'),
  name          text not null check (char_length(btrim(name)) between 1 and 80),
  kind          text not null default 'barber'
                check (kind in ('barber', 'salon', 'both')),
  status        text not null default 'trial'
                check (status in ('trial', 'active', 'past_due', 'suspended', 'cancelled')),
  plan_id       uuid references public.plans(id) on delete set null,
  trial_ends_at timestamptz,
  paid_until    timestamptz,
  custom_domain text unique,
  timezone      text not null default 'Asia/Baghdad',
  owner_id      uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index shops_status_idx on public.shops (status);

-- ── Shop members (who can log in to a shop's dashboard) ─────────────────────
create table public.shop_members (
  shop_id    uuid not null references public.shops(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'owner' check (role in ('owner', 'manager', 'staff')),
  created_at timestamptz not null default now(),
  primary key (shop_id, user_id)
);
create index shop_members_user_idx on public.shop_members (user_id);

-- ── Payments (recorded by you; cash / FIB / ZainCash …) ─────────────────────
create table public.payments (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid not null references public.shops(id) on delete cascade,
  plan_id      uuid references public.plans(id) on delete set null,
  amount_iqd   integer not null check (amount_iqd >= 0),
  method       text not null default 'cash'
               check (method in ('cash', 'fib', 'zaincash', 'fastpay', 'bank', 'other')),
  reference    text,
  note         text,
  months       integer not null check (months between 1 and 36),
  period_start timestamptz not null,
  period_end   timestamptz not null,
  recorded_by  uuid references auth.users(id) on delete set null,
  paid_at      timestamptz not null default now()
);
create index payments_shop_idx on public.payments (shop_id, paid_at desc);

-- ── Helper functions (used by RLS policies) ─────────────────────────────────
create function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_super_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

create function public.is_shop_member(p_shop_id uuid, p_roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.shop_members m
    where m.shop_id = p_shop_id
      and m.user_id = auth.uid()
      and (p_roles is null or m.role = any (p_roles))
  );
$$;

-- Owners and managers edit a shop's content; you (super admin) can too.
create function public.can_manage_shop(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_super_admin()
      or public.is_shop_member(p_shop_id, array['owner', 'manager']);
$$;

-- Same check for a storage folder name ("<shop_id>/…"), without a uuid cast
-- that would throw on a malformed path.
create function public.can_manage_shop_folder(p_folder text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_super_admin()
      or exists (
        select 1 from public.shop_members m
        where m.shop_id::text = p_folder
          and m.user_id = auth.uid()
          and m.role in ('owner', 'manager')
      );
$$;

-- A shop's public page and booking work while it's on trial, active, or in
-- the grace period. Suspended/cancelled shops show a "closed" page.
create function public.shop_is_live(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.shops s
    where s.id = p_shop_id
      and s.status in ('trial', 'active', 'past_due')
  );
$$;

-- Subdomains that can never be a shop.
create function public.slug_available(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_slug ~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$'
     and lower(p_slug) not in (
       'www', 'app', 'api', 'admin', 'super', 'dashboard', 'login', 'signup',
       'pricing', 'help', 'support', 'mail', 'static', 'assets', 'cdn', 'status',
       'blog', 's', 'shop', 'shops', 'auth', 'billing', 'kurdbooking'
     )
     and not exists (select 1 from public.shops s where s.slug = lower(p_slug));
$$;

-- Public lookup for the storefront: only the columns a customer may see.
create function public.shop_by_slug(p_slug text)
returns table (id uuid, slug text, name text, kind text, timezone text, is_live boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.slug, s.name, s.kind, s.timezone,
         s.status in ('trial', 'active', 'past_due')
  from public.shops s
  where s.slug = lower(p_slug);
$$;
