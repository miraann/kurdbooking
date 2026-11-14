-- ============================================================================
-- KurdBooking — 0012: rate limits for public forms and logins
--
--   * rate_limits      one row per counted attempt: a key such as
--                      'booking:<hashed IP>' and the time. Server only.
--   * hit_rate_limit(key, max, window_seconds)
--                      true  = allowed (and this attempt is counted)
--                      false = over the limit, try later
--
-- Replaces zhewar's Upstash limiter with the database we already have
-- (lib/rate-limit.ts calls it with the secret key). Keys hold a keyed hash of
-- the visitor's IP, never the IP itself. Rows older than a day are removed by
-- the function as it goes, so the table stays small without a cron job.
-- ============================================================================

create table public.rate_limits (
  key     text not null check (char_length(key) between 1 and 200),
  hit_at  timestamptz not null default now()
);
create index rate_limits_key_time_idx on public.rate_limits (key, hit_at);
create index rate_limits_time_idx on public.rate_limits (hit_at);

comment on table public.rate_limits is 'Attempts counted by hit_rate_limit(). Server only; rows older than a day are deleted.';

alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;
grant all on public.rate_limits to service_role;

create or replace function public.hit_rate_limit(p_key text, p_max int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if p_key is null or p_max is null or p_max < 1
     or p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'bad_rate_limit';
  end if;

  -- One request at a time per key, so two quick ones can't both slip in.
  perform pg_advisory_xact_lock(hashtextextended('kb-rate:' || p_key, 0));

  -- Now and then, forget attempts older than the longest window (a day).
  if random() < 0.02 then
    delete from public.rate_limits where hit_at < now() - interval '1 day';
  end if;

  select count(*) into n
    from public.rate_limits
   where key = p_key and hit_at > now() - make_interval(secs => p_window_seconds);
  if n >= p_max then
    return false;
  end if;

  insert into public.rate_limits (key) values (p_key);
  return true;
end;
$$;

revoke execute on function public.hit_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, int, int) to service_role;
