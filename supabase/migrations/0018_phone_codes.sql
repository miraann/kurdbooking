-- ============================================================================
-- KurdBooking — 0018: WhatsApp codes that prove a customer owns a phone
--
--   * phone_codes            one row per (phone, purpose): the newest code, as a
--                            keyed hash (never the code), when it expires and how
--                            many wrong guesses it has had. Server only.
--   * issue_phone_code()     stores a new code; refuses a second one within the
--                            cooldown (so nobody can make us send many messages)
--   * check_phone_code()     true once, for the right code; wrong guesses are
--                            counted and the code dies after 5
--   * customer_user_id()     the customer account of a phone, if there is one
--
-- Used by the customer signup and "forgot password" (lib/phone-code.server.ts).
-- Everything here is for the server's secret key only.
-- ============================================================================

create table public.phone_codes (
  phone       text not null check (phone ~ '^[0-9]{7,15}$'),
  purpose     text not null check (purpose in ('signup', 'reset')),
  code_hash   text not null,
  expires_at  timestamptz not null,
  attempts    int  not null default 0,
  created_at  timestamptz not null default now(),
  primary key (phone, purpose)
);
create index phone_codes_created_idx on public.phone_codes (created_at);

comment on table public.phone_codes is 'Newest WhatsApp verification code per phone and purpose (hashed). Server only.';

alter table public.phone_codes enable row level security;
revoke all on public.phone_codes from anon, authenticated;
grant all on public.phone_codes to service_role;

-- true = stored, send it. false = a code was sent less than p_cooldown_seconds ago.
create or replace function public.issue_phone_code(
  p_phone text, p_purpose text, p_code_hash text,
  p_ttl_seconds int default 600, p_cooldown_seconds int default 60
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_ttl_seconds < 1 or p_ttl_seconds > 3600 or p_cooldown_seconds < 0 then
    raise exception 'bad_code_settings';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('kb-code:' || p_phone || p_purpose, 0));

  if exists (
    select 1 from public.phone_codes
     where phone = p_phone and purpose = p_purpose
       and created_at > now() - make_interval(secs => p_cooldown_seconds)
  ) then
    return false;
  end if;

  -- Now and then, forget codes that expired long ago.
  if random() < 0.05 then
    delete from public.phone_codes where expires_at < now() - interval '1 day';
  end if;

  insert into public.phone_codes (phone, purpose, code_hash, expires_at, attempts, created_at)
  values (p_phone, p_purpose, p_code_hash, now() + make_interval(secs => p_ttl_seconds), 0, now())
  on conflict (phone, purpose) do update
    set code_hash = excluded.code_hash, expires_at = excluded.expires_at,
        attempts = 0, created_at = excluded.created_at;
  return true;
end;
$$;

-- true = right code (and it is used up). false = wrong, expired or too many tries.
create or replace function public.check_phone_code(p_phone text, p_purpose text, p_code_hash text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.phone_codes;
begin
  perform pg_advisory_xact_lock(hashtextextended('kb-code:' || p_phone || p_purpose, 0));
  select * into r from public.phone_codes where phone = p_phone and purpose = p_purpose;
  if not found or r.expires_at < now() or r.attempts >= 5 then
    return false;
  end if;
  if r.code_hash = p_code_hash then
    delete from public.phone_codes where phone = p_phone and purpose = p_purpose;
    return true;
  end if;
  update public.phone_codes set attempts = attempts + 1 where phone = p_phone and purpose = p_purpose;
  return false;
end;
$$;

-- The customer account that belongs to a phone (null = none). The account's
-- login is the stand-in email <phone>@phone.invalid (lib/customer.ts).
create or replace function public.customer_user_id(p_phone text)
returns uuid
language sql
security definer
set search_path = public, auth
stable
as $$
  select id from auth.users where lower(email) = p_phone || '@phone.invalid' limit 1;
$$;

revoke execute on function public.issue_phone_code(text, text, text, int, int) from public, anon, authenticated;
revoke execute on function public.check_phone_code(text, text, text) from public, anon, authenticated;
revoke execute on function public.customer_user_id(text) from public, anon, authenticated;
grant execute on function public.issue_phone_code(text, text, text, int, int) to service_role;
grant execute on function public.check_phone_code(text, text, text) to service_role;
grant execute on function public.customer_user_id(text) to service_role;
