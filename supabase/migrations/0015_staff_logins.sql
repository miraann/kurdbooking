-- ============================================================================
-- KurdBooking — 0015: staff logins
--
-- An owner or manager gives a staff member their own login (Dashboard →
-- Staff → the person). The server (secret key) creates the account, adds a
-- shop_members row with role 'staff' and links staff.user_id, so booking
-- pushes for that person reach their phone (lib/push.ts → notifyShop).
--
-- Rule added here: only the server links a staff row to an account, like
-- customers.user_id (0008). Otherwise an owner could point a staff row at
-- anyone's account and send them that shop's booking alerts.
-- create_shop_for_owner() (security definer) still links the owner's row.
-- ============================================================================

create function public.staff_guard_user_id()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated')
     and new.user_id is distinct from (case when tg_op = 'UPDATE' then old.user_id end) then
    raise exception 'staff_link_forbidden' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger staff_guard_user_id before insert or update of user_id on public.staff
  for each row execute function public.staff_guard_user_id();
