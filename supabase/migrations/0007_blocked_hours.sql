-- Block hours by hand: a row in blocked_dates can now close part of a day.
--   start_time and end_time empty → the whole day is closed (as before)
--   both set                      → only start_time–end_time is closed
-- staff_id null still means the whole shop; set means one staff member.
-- A day may now have several closed ranges, so the old "one row per
-- shop/staff/day" rule is replaced by "one row per shop/staff/day/start".

alter table public.blocked_dates
  add column start_time time,
  add column end_time   time,
  add constraint blocked_dates_time_range check (
    (start_time is null and end_time is null)
    or (start_time is not null and end_time is not null and end_time > start_time)
  );

alter table public.blocked_dates drop constraint if exists blocked_dates_shop_id_staff_id_date_key;
alter table public.blocked_dates
  add constraint blocked_dates_one_per_start unique nulls not distinct (shop_id, staff_id, date, start_time);

comment on column public.blocked_dates.start_time is 'Shop-local start of a closed range; null with end_time null = whole day';
comment on column public.blocked_dates.end_time is 'Shop-local end of a closed range (after start_time)';
