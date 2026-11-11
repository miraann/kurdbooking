-- ============================================================================
-- KurdBooking — 0008: groundwork for the customer app (Phase 6)
--   * shops.listed / shops.hidden_by_admin   «پیشاندان لە ئەپ» switch
--   * customers.user_id                      a customer account, per shop
--   * customers.blocked_at                   the owner blocks a customer
--   * reviews                                1–5 stars after a completed visit
--
-- Rules:
--   * The app's shop list shows live shops that are listed by the owner and
--     not hidden by you. Hidden shops still open by link/QR (shop_by_slug).
--   * A logged-in customer reads only their own bookings, in every shop. They
--     never read the customers table itself (it holds the shop's notes).
--   * Only the server (secret key) links a customer row to an account.
--   * A blocked customer can't get a new booking at that shop.
--   * Reviews are written only through the functions below: one per
--     completed booking, the owner replies once, only you hide a review, and
--     nobody but you deletes one (deleting the booking keeps the review).
-- ============================================================================

-- ── Shop list in the app ────────────────────────────────────────────────────
alter table public.shops
  add column listed          boolean not null default true,
  add column hidden_by_admin boolean not null default false;

comment on column public.shops.listed is 'Owner switch «پیشاندان لە ئەپ»: show the shop in the customer app list';
comment on column public.shops.hidden_by_admin is 'Super admin hides the shop from the app list (the link still works)';

-- Owners can't update public.shops directly (0005), so the switch has its
-- own function that checks the role.
create function public.set_shop_listed(p_shop_id uuid, p_listed boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_manage_shop(p_shop_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.shops set listed = coalesce(p_listed, true) where id = p_shop_id;
end;
$$;

revoke execute on function public.set_shop_listed(uuid, boolean) from public, anon;
grant execute on function public.set_shop_listed(uuid, boolean) to authenticated;

-- ── Customer accounts and blocking ──────────────────────────────────────────
alter table public.customers
  add column user_id    uuid references auth.users(id) on delete set null,
  add column blocked_at timestamptz,
  add constraint customers_one_per_user unique (shop_id, user_id);
create index customers_user_idx on public.customers (user_id) where user_id is not null;

comment on column public.customers.user_id is 'The customer app account this shop customer belongs to (set by the server only)';
comment on column public.customers.blocked_at is 'Set when the owner blocks this customer; null = may book';

-- Owners write customer rows (0005), but only the server may link a row to an
-- account: otherwise an owner could attach anyone's account to a customer.
create function public.customers_guard_user_id()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated')
     and new.user_id is distinct from (case when tg_op = 'UPDATE' then old.user_id end) then
    raise exception 'customer_link_forbidden' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger customers_guard_user_id before insert or update of user_id on public.customers
  for each row execute function public.customers_guard_user_id();

-- Final guard: no new booking for a blocked customer (book/actions.ts checks
-- first, to show a clear message).
create function public.appointments_check_blocked()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.customers c
    where c.shop_id = new.shop_id and c.id = new.customer_id and c.blocked_at is not null
  ) then
    raise exception 'customer_blocked' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger appointments_check_blocked before insert on public.appointments
  for each row execute function public.appointments_check_blocked();

-- ── Reviews: the table (its functions are further down) ────────────────────
alter table public.appointments
  add constraint appointments_shop_id_id_key unique (shop_id, id);

create table public.reviews (
  id             uuid primary key default gen_random_uuid(),
  shop_id        uuid not null references public.shops(id) on delete cascade,
  -- Kept (set to null) when the owner deletes the booking or the customer, so
  -- deleting them never removes a review.
  appointment_id uuid unique,
  customer_id    uuid,
  user_id        uuid references auth.users(id) on delete set null,
  reviewer_name  text not null default '' check (char_length(reviewer_name) <= 80),
  rating         smallint not null check (rating between 1 and 5),
  body           text check (body is null or char_length(body) <= 1000),
  reply          text check (reply is null or char_length(reply) <= 1000),
  replied_at     timestamptz,
  is_hidden      boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  foreign key (shop_id, appointment_id) references public.appointments (shop_id, id) on delete set null (appointment_id),
  foreign key (shop_id, customer_id)    references public.customers (shop_id, id)    on delete set null (customer_id)
);
create index reviews_shop_idx on public.reviews (shop_id, created_at desc);
create index reviews_user_idx on public.reviews (user_id);

create trigger reviews_touch before update on public.reviews
  for each row execute function public.touch_updated_at();

alter table public.reviews enable row level security;

-- Members, you, and the writer read the full row. The public reads through
-- shop_reviews() / shop_rating(), which leave out ids and hidden reviews.
-- No insert/update/delete policies: writes go through the functions below.
create policy "reviews: members, super or writer read" on public.reviews for select to authenticated
  using (public.is_shop_member(shop_id) or public.is_super_admin() or user_id = auth.uid());
create policy "reviews: super deletes" on public.reviews for delete to authenticated
  using (public.is_super_admin());

-- Is this shop customer row the logged-in user's? (security definer: the
-- customer can't read public.customers itself.)
create function public.is_own_customer(p_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.customers c
    where c.id = p_customer_id and c.user_id = auth.uid()
  );
$$;

grant execute on function public.is_own_customer(uuid) to authenticated;

create policy "appointments: customer reads own" on public.appointments for select to authenticated
  using (public.is_own_customer(customer_id));

-- "My bookings" in the app: every shop, with the names the list needs.
create function public.my_appointments()
returns table (
  id             uuid,
  shop_id        uuid,
  shop_slug      text,
  shop_name      text,
  shop_logo_url  text,
  staff_name     text,
  service_name   text,
  price_iqd      integer,
  starts_at      timestamptz,
  ends_at        timestamptz,
  status         text,
  public_token   uuid,
  can_cancel     boolean,
  can_review     boolean,
  my_rating      smallint
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.shop_id, s.slug, s.name, p.logo_url, st.name, a.service_name, a.price_iqd,
         a.starts_at, a.ends_at, a.status, a.public_token,
         a.status in ('pending', 'confirmed') and a.starts_at > now(),
         a.status = 'completed' and r.id is null,
         r.rating
  from public.appointments a
  join public.customers c on c.shop_id = a.shop_id and c.id = a.customer_id
  join public.shops s on s.id = a.shop_id
  left join public.shop_profile p on p.shop_id = a.shop_id
  left join public.staff st on st.shop_id = a.shop_id and st.id = a.staff_id
  left join public.reviews r on r.appointment_id = a.id
  where auth.uid() is not null and c.user_id = auth.uid()
  order by a.starts_at desc;
$$;

-- The customer cancels their own upcoming booking.
create function public.cancel_my_appointment(p_appointment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appt public.appointments;
begin
  select a.* into v_appt
  from public.appointments a
  join public.customers c on c.shop_id = a.shop_id and c.id = a.customer_id
  where a.id = p_appointment_id and auth.uid() is not null and c.user_id = auth.uid()
  for update of a;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_appt.status not in ('pending', 'confirmed') or v_appt.starts_at <= now() then
    raise exception 'cannot_cancel' using errcode = 'P0001';
  end if;
  update public.appointments set status = 'cancelled' where id = p_appointment_id;
end;
$$;

-- The customer reviews a completed booking of their own, once.
create function public.submit_review(p_appointment_id uuid, p_rating integer, p_body text default null)
returns public.reviews
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appt   public.appointments;
  v_name   text;
  v_review public.reviews;
begin
  select a.* into v_appt
  from public.appointments a
  join public.customers c on c.shop_id = a.shop_id and c.id = a.customer_id
  where a.id = p_appointment_id and auth.uid() is not null and c.user_id = auth.uid();
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  select c.full_name into v_name
  from public.customers c where c.shop_id = v_appt.shop_id and c.id = v_appt.customer_id;
  if v_appt.status <> 'completed' then
    raise exception 'not_completed' using errcode = 'P0001';
  end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'invalid_rating' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.reviews r where r.appointment_id = p_appointment_id) then
    raise exception 'already_reviewed' using errcode = 'P0001';
  end if;

  insert into public.reviews (shop_id, appointment_id, customer_id, user_id, reviewer_name, rating, body)
  values (v_appt.shop_id, v_appt.id, v_appt.customer_id, auth.uid(),
          -- First name only on the public page.
          left(split_part(btrim(coalesce(v_name, '')), ' ', 1), 80),
          p_rating, nullif(btrim(coalesce(p_body, '')), ''))
  returning * into v_review;
  return v_review;
end;
$$;

-- The owner or a manager replies once.
create function public.reply_to_review(p_review_id uuid, p_reply text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_review public.reviews;
begin
  select * into v_review from public.reviews where id = p_review_id for update;
  if not found or not public.can_manage_shop(v_review.shop_id) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_review.reply is not null then
    raise exception 'already_replied' using errcode = 'P0001';
  end if;
  if nullif(btrim(coalesce(p_reply, '')), '') is null then
    raise exception 'empty_reply' using errcode = 'P0001';
  end if;
  update public.reviews set reply = btrim(p_reply), replied_at = now() where id = p_review_id;
end;
$$;

-- You hide (or show again) an abusive review.
create function public.set_review_hidden(p_review_id uuid, p_hidden boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_super_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.reviews set is_hidden = coalesce(p_hidden, true) where id = p_review_id;
end;
$$;

-- Public: a live shop's rating.
create function public.shop_rating(p_shop_id uuid)
returns table (rating_avg numeric, rating_count integer)
language sql
stable
security definer
set search_path = ''
as $$
  select round(avg(r.rating)::numeric, 1), count(r.id)::int
  from public.reviews r
  where r.shop_id = p_shop_id and not r.is_hidden and public.shop_is_live(p_shop_id);
$$;

-- Public: a live shop's visible reviews, newest first.
create function public.shop_reviews(p_shop_id uuid, p_limit integer default 20, p_offset integer default 0)
returns table (
  id            uuid,
  reviewer_name text,
  rating        smallint,
  body          text,
  reply         text,
  replied_at    timestamptz,
  created_at    timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.reviewer_name, r.rating, r.body, r.reply, r.replied_at, r.created_at
  from public.reviews r
  where r.shop_id = p_shop_id and not r.is_hidden and public.shop_is_live(p_shop_id)
  order by r.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- Public: the app's home list. kind 'both' shows under both filters.
create function public.listed_shops(p_kind text default null, p_search text default null)
returns table (
  id            uuid,
  slug          text,
  name          text,
  kind          text,
  tagline       text,
  logo_url      text,
  cover_url     text,
  rating_avg    numeric,
  rating_count  integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.slug, s.name, s.kind, p.tagline, p.logo_url, p.cover_url,
         round(avg(r.rating)::numeric, 1), count(r.id)::int
  from public.shops s
  left join public.shop_profile p on p.shop_id = s.id
  left join public.reviews r on r.shop_id = s.id and not r.is_hidden
  where s.status in ('trial', 'active', 'past_due')
    and s.listed and not s.hidden_by_admin
    and (p_kind is null or s.kind = p_kind or s.kind = 'both')
    and (nullif(btrim(coalesce(p_search, '')), '') is null
         or s.name ilike '%' || replace(replace(replace(btrim(p_search), '\', '\\'), '%', '\%'), '_', '\_') || '%')
  group by s.id, p.shop_id
  order by count(r.id) desc, s.name;
$$;

-- ── Grants ──────────────────────────────────────────────────────────────────
revoke execute on function
  public.my_appointments(), public.cancel_my_appointment(uuid),
  public.submit_review(uuid, integer, text), public.reply_to_review(uuid, text),
  public.set_review_hidden(uuid, boolean)
  from public, anon;
grant execute on function
  public.my_appointments(), public.cancel_my_appointment(uuid),
  public.submit_review(uuid, integer, text), public.reply_to_review(uuid, text),
  public.set_review_hidden(uuid, boolean)
  to authenticated;
grant execute on function
  public.shop_rating(uuid), public.shop_reviews(uuid, integer, integer), public.listed_shops(text, text)
  to anon, authenticated;
revoke all on public.reviews from anon;
grant select, insert, update, delete on public.reviews to authenticated, service_role;
