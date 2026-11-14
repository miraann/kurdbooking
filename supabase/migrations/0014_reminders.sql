-- ============================================================================
-- KurdBooking — 0014: day-before reminders
--
-- A daily job (Vercel cron → app/api/cron/reminders) sends a push to every
-- customer with a confirmed booking tomorrow. reminded_at marks the bookings
-- it already handled, so a second run (or a retry) never sends twice: the
-- job claims rows with "update … where reminded_at is null returning id".
-- ============================================================================

alter table public.appointments add column reminded_at timestamptz;

comment on column public.appointments.reminded_at is 'When the day-before reminder was handled (null = not yet)';

create index appointments_remind_idx on public.appointments (starts_at)
  where status = 'confirmed' and reminded_at is null;
