-- ============================================================================
-- KurdBooking — 0004: business functions
--   create_shop_for_owner  signup (server only)
--   record_payment         super admin records a payment → shop active
--   extend_trial           super admin gives extra trial days
--   refresh_shop_statuses  trial/paid end → past_due → suspended (cron, 0006)
-- ============================================================================

-- ── Signup: shop + owner membership + sensible defaults ─────────────────────
-- Called by app/(platform)/signup/actions.ts with the secret key, right after
-- it creates the auth user. Not callable from the browser.
create function public.create_shop_for_owner(
  p_owner_id   uuid,
  p_name       text,
  p_slug       text,
  p_kind       text,
  p_owner_name text,
  p_phone      text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shop  uuid;
  v_trial integer;
begin
  if not public.slug_available(p_slug) then
    raise exception 'slug_taken' using errcode = 'P0001';
  end if;

  select s.trial_days into v_trial from public.platform_settings s where s.id;

  insert into public.shops (slug, name, kind, status, trial_ends_at, owner_id)
  values (lower(p_slug), btrim(p_name), p_kind, 'trial',
          now() + make_interval(days => coalesce(v_trial, 14)), p_owner_id)
  returning id into v_shop;

  insert into public.shop_members (shop_id, user_id, role)
  values (v_shop, p_owner_id, 'owner');

  insert into public.shop_profile (shop_id, phone, whatsapp)
  values (v_shop, p_phone, p_phone);

  -- Every shop starts with one staff member: the owner.
  insert into public.staff (shop_id, user_id, name, sort_order)
  values (v_shop, p_owner_id, coalesce(nullif(btrim(p_owner_name), ''), btrim(p_name)), 0);

  -- Open every day 10:00–20:00; the owner adjusts it in /dashboard/schedule.
  insert into public.working_hours (shop_id, day_of_week, is_open, open_time, close_time)
  select v_shop, d, true, time '10:00', time '20:00'
  from generate_series(0, 6) as d;

  insert into public.whatsapp_templates (shop_id, kind, title, body, sort_order) values
    (v_shop, 'accept',   'پەسەندکردن',
     'سڵاو {name}، کاتی سەردانیکردنت لە {shop} بۆ {date} کاتژمێر {time} پەسەند کرا. تکایە ٥ خولەک زووتر ئامادەبە.', 0),
    (v_shop, 'decline',  'ببورە',
     'سڵاو {name}، ببورە ئەو کاتە بەردەست نییە. تکایە کاتێکی تر هەڵبژێرە: {link}', 0),
    (v_shop, 'reminder', 'بیرخستنەوە',
     'سڵاو {name}، بیرت دەخەینەوە کە {date} کاتژمێر {time} کاتی سەردانیکردنت هەیە لە {shop}.', 0);

  return v_shop;
end;
$$;

revoke execute on function public.create_shop_for_owner(uuid, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_shop_for_owner(uuid, text, text, text, text, text)
  to service_role;

-- ── Record a payment (super admin) ──────────────────────────────────────────
-- Paid time starts when the current trial/paid period ends (or now, if that
-- is already over), so paying early never loses days.
create function public.record_payment(
  p_shop_id    uuid,
  p_plan_id    uuid,
  p_months     integer,
  p_amount_iqd integer,
  p_method     text,
  p_reference  text default null,
  p_note       text default null
)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shop    public.shops;
  v_start   timestamptz;
  v_end     timestamptz;
  v_payment public.payments;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_months is null or p_months < 1 or p_months > 36 then
    raise exception 'invalid_months' using errcode = 'P0001';
  end if;

  select * into v_shop from public.shops where id = p_shop_id for update;
  if not found then
    raise exception 'shop_not_found' using errcode = 'P0001';
  end if;

  v_start := greatest(now(),
                      coalesce(v_shop.paid_until, now()),
                      coalesce(v_shop.trial_ends_at, now()));
  v_end   := v_start + make_interval(months => p_months);

  insert into public.payments
    (shop_id, plan_id, amount_iqd, method, reference, note, months, period_start, period_end, recorded_by)
  values
    (p_shop_id, p_plan_id, p_amount_iqd, p_method, p_reference, p_note, p_months, v_start, v_end, auth.uid())
  returning * into v_payment;

  update public.shops
  set paid_until = v_end,
      status     = 'active',
      plan_id    = coalesce(p_plan_id, plan_id)
  where id = p_shop_id;

  return v_payment;
end;
$$;

revoke execute on function public.record_payment(uuid, uuid, integer, integer, text, text, text) from public, anon;
grant execute on function public.record_payment(uuid, uuid, integer, integer, text, text, text) to authenticated;

-- ── Extend a trial (super admin) ────────────────────────────────────────────
create function public.extend_trial(p_shop_id uuid, p_days integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_super_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_days is null or p_days < 1 or p_days > 365 then
    raise exception 'invalid_days' using errcode = 'P0001';
  end if;

  update public.shops
  set trial_ends_at = greatest(coalesce(trial_ends_at, now()), now()) + make_interval(days => p_days),
      status = case when status in ('past_due', 'suspended', 'trial') and
                         (paid_until is null or paid_until <= now())
                    then 'trial' else status end
  where id = p_shop_id;
end;
$$;

revoke execute on function public.extend_trial(uuid, integer) from public, anon;
grant execute on function public.extend_trial(uuid, integer) to authenticated;

-- ── Status job: trial/paid period over → past_due → suspended ───────────────
-- Cancelled and suspended shops are left alone: a suspended shop comes back
-- through record_payment() or extend_trial().
create function public.refresh_shop_statuses()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grace interval;
  v_count integer;
begin
  select make_interval(days => s.grace_days) into v_grace
  from public.platform_settings s where s.id;
  v_grace := coalesce(v_grace, interval '5 days');

  with calc as (
    select s.id,
           s.status,
           s.paid_until,
           greatest(coalesce(s.trial_ends_at, '-infinity'::timestamptz),
                    coalesce(s.paid_until,    '-infinity'::timestamptz)) as ends_at
    from public.shops s
    where s.status in ('trial', 'active', 'past_due')
  ),
  next_status as (
    select c.id,
           case
             when now() < c.ends_at then
               case when c.paid_until is not null and c.paid_until > now() then 'active' else 'trial' end
             when now() < c.ends_at + v_grace then 'past_due'
             else 'suspended'
           end as status
    from calc c
  )
  update public.shops s
  set status = n.status
  from next_status n
  where s.id = n.id and s.status <> n.status;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.refresh_shop_statuses() from public, anon, authenticated;
