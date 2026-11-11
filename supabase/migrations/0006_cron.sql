-- ============================================================================
-- KurdBooking — 0006: scheduled jobs (pg_cron)
-- If this fails, enable "pg_cron" under Database → Extensions in the
-- Supabase dashboard first, then run this file again.
-- ============================================================================

create extension if not exists pg_cron with schema pg_catalog;

-- Every hour: move shops whose trial/paid time ended to past_due, and past
-- the grace days to suspended.
select cron.schedule(
  'kb-refresh-shop-statuses',
  '5 * * * *',
  $$ select public.refresh_shop_statuses(); $$
);

-- Keep pg_cron's own run log small.
select cron.schedule(
  'kb-purge-cron-history',
  '30 3 * * *',
  $$ delete from cron.job_run_details where end_time < now() - interval '7 days'; $$
);
