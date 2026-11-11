-- ============================================================================
-- KurdBooking — 0002: shop content (Side 2: what each shop manages)
-- Every table carries shop_id. Tables that other rows point at also have
-- unique (shop_id, id), so composite foreign keys keep every reference
-- inside the same shop (a booking can't point at another shop's staff).
-- ============================================================================

-- ── Profile, branding, contact, booking rules (one row per shop) ────────────
create table public.shop_profile (
  shop_id               uuid primary key references public.shops(id) on delete cascade,
  tagline               text,
  about                 text,
  logo_url              text,
  cover_url             text,
  primary_color         text not null default '#2563eb' check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  accent_color          text not null default '#ef4444' check (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  phone                 text,
  whatsapp              text,
  email                 text,
  booking_enabled       boolean not null default true,
  auto_confirm          boolean not null default false,  -- false = owner accepts each booking
  slot_interval_minutes integer not null default 30 check (slot_interval_minutes between 5 and 240),
  min_notice_minutes    integer not null default 60 check (min_notice_minutes between 0 and 10080),
  max_days_ahead        integer not null default 30 check (max_days_ahead between 1 and 365),
  updated_at            timestamptz not null default now()
);

-- ── Locations / branches ────────────────────────────────────────────────────
create table public.locations (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops(id) on delete cascade,
  name       text not null default '',
  address    text,
  city       text,
  lat        double precision check (lat between -90 and 90),
  lng        double precision check (lng between -180 and 180),
  maps_url   text,
  phone      text,
  is_primary boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index locations_shop_idx on public.locations (shop_id, sort_order);

-- ── Services (haircut, beard, colour …) ─────────────────────────────────────
create table public.services (
  id               uuid primary key default gen_random_uuid(),
  shop_id          uuid not null references public.shops(id) on delete cascade,
  name             text not null check (char_length(btrim(name)) between 1 and 80),
  description      text,
  category         text,
  duration_minutes integer not null default 30 check (duration_minutes between 5 and 600),
  price_iqd        integer check (price_iqd >= 0),
  image_url        text,
  is_active        boolean not null default true,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  unique (shop_id, id)
);
create index services_shop_idx on public.services (shop_id, sort_order);

-- ── Staff (barbers / stylists). Every shop has at least one. ────────────────
create table public.staff (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete set null,
  name       text not null check (char_length(btrim(name)) between 1 and 80),
  title      text,
  bio        text,
  photo_url  text,
  is_active  boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (shop_id, id)
);
create index staff_shop_idx on public.staff (shop_id, sort_order);

-- Which staff member does which service. No rows for a staff member = they do
-- every service.
create table public.staff_services (
  shop_id    uuid not null,
  staff_id   uuid not null,
  service_id uuid not null,
  primary key (staff_id, service_id),
  foreign key (shop_id, staff_id)   references public.staff (shop_id, id)    on delete cascade,
  foreign key (shop_id, service_id) references public.services (shop_id, id) on delete cascade
);

-- ── Working hours. staff_id null = the shop's hours; a row with staff_id
--    overrides the shop's hours for that person on that day. ────────────────
create table public.working_hours (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops(id) on delete cascade,
  staff_id    uuid,
  day_of_week smallint not null check (day_of_week between 0 and 6),  -- 0 = Sunday
  is_open     boolean not null default true,
  open_time   time not null default '10:00',
  close_time  time not null default '20:00',
  break_start time,
  break_end   time,
  check (close_time > open_time),
  check ((break_start is null) = (break_end is null)),
  check (break_start is null or (break_start >= open_time and break_end <= close_time and break_end > break_start)),
  foreign key (shop_id, staff_id) references public.staff (shop_id, id) on delete cascade,
  unique nulls not distinct (shop_id, staff_id, day_of_week)
);

-- ── Days off (whole shop when staff_id is null) ─────────────────────────────
create table public.blocked_dates (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops(id) on delete cascade,
  staff_id   uuid,
  date       date not null,
  reason     text,
  created_at timestamptz not null default now(),
  foreign key (shop_id, staff_id) references public.staff (shop_id, id) on delete cascade,
  unique nulls not distinct (shop_id, staff_id, date)
);

-- ── Gallery ─────────────────────────────────────────────────────────────────
create table public.gallery_photos (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops(id) on delete cascade,
  image_url  text not null,
  caption    text,
  category   text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index gallery_shop_idx on public.gallery_photos (shop_id, sort_order);

-- ── Social media posts (link + preview image, shown as cards) ───────────────
create table public.posts (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops(id) on delete cascade,
  platform   text not null default 'instagram'
             check (platform in ('instagram', 'facebook', 'tiktok', 'snapchat', 'youtube', 'other')),
  url        text not null,
  image_url  text,
  caption    text,
  posted_at  date,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index posts_shop_idx on public.posts (shop_id, sort_order);

-- ── Social media links (icons on the shop page) ─────────────────────────────
create table public.social_links (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops(id) on delete cascade,
  platform   text not null default 'instagram'
             check (platform in ('instagram', 'facebook', 'tiktok', 'snapchat', 'youtube',
                                 'whatsapp', 'telegram', 'website', 'other')),
  title      text,
  url        text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index social_links_shop_idx on public.social_links (shop_id, sort_order);

-- ── WhatsApp message templates (accept / decline / reminder) ────────────────
create table public.whatsapp_templates (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops(id) on delete cascade,
  kind       text not null check (kind in ('accept', 'decline', 'reminder')),
  title      text not null check (char_length(btrim(title)) between 1 and 80),
  body       text not null check (char_length(btrim(body)) between 1 and 1000),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index whatsapp_templates_shop_idx on public.whatsapp_templates (shop_id, kind, sort_order);

-- ── Push tokens for the owner apps (Android / iOS / Windows / web) ──────────
create table public.device_tokens (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  token      text not null unique,
  platform   text not null check (platform in ('android', 'ios', 'web', 'windows')),
  created_at timestamptz not null default now()
);
create index device_tokens_shop_idx on public.device_tokens (shop_id);
