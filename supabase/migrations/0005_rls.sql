-- ============================================================================
-- KurdBooking — 0005: row level security, grants, storage
--
-- Rules in one line each:
--   * Customers (anon) read a shop's public content only while the shop is live.
--   * Owners/managers (authenticated) read and write only their own shop's rows.
--   * You (profiles.is_super_admin) can read and write everything.
--   * customers / appointments: no public access at all; bookings are written
--     by the server with the secret key (which bypasses RLS).
-- ============================================================================

-- ── Grants (RLS below decides which rows) ───────────────────────────────────
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant select on
  public.plans, public.platform_settings,
  public.shop_profile, public.locations, public.services, public.staff, public.staff_services,
  public.working_hours, public.blocked_dates, public.gallery_photos, public.posts, public.social_links
  to anon;
grant execute on function
  public.shop_by_slug(text), public.slug_available(text), public.shop_is_live(uuid)
  to anon, authenticated;

-- profiles: users may change their own name/phone, never is_super_admin.
revoke update on public.profiles from authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- ── Enable RLS everywhere ───────────────────────────────────────────────────
alter table public.platform_settings  enable row level security;
alter table public.profiles           enable row level security;
alter table public.plans              enable row level security;
alter table public.shops              enable row level security;
alter table public.shop_members       enable row level security;
alter table public.payments           enable row level security;
alter table public.shop_profile       enable row level security;
alter table public.locations          enable row level security;
alter table public.services           enable row level security;
alter table public.staff              enable row level security;
alter table public.staff_services     enable row level security;
alter table public.working_hours      enable row level security;
alter table public.blocked_dates      enable row level security;
alter table public.gallery_photos     enable row level security;
alter table public.posts              enable row level security;
alter table public.social_links       enable row level security;
alter table public.whatsapp_templates enable row level security;
alter table public.device_tokens      enable row level security;
alter table public.customers          enable row level security;
alter table public.appointments       enable row level security;

-- ── Platform ────────────────────────────────────────────────────────────────
create policy "settings: anyone reads"  on public.platform_settings for select using (true);
create policy "settings: super updates" on public.platform_settings for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

create policy "profiles: own or super reads" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_super_admin());
create policy "profiles: own updates" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "plans: public plans readable" on public.plans for select
  using (is_public or public.is_super_admin());
create policy "plans: super writes" on public.plans for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- Shops: members see their shop; super sees all. The public storefront uses
-- shop_by_slug() instead of reading this table.
create policy "shops: members read" on public.shops for select to authenticated
  using (public.is_shop_member(id) or public.is_super_admin());
-- Status, plan and dates change only through record_payment / extend_trial /
-- the status job, or by you in /super. Owners rename their shop through the
-- server (see app/dashboard/profile), which checks the role first.
create policy "shops: super writes" on public.shops for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

create policy "members: self, owner or super reads" on public.shop_members for select to authenticated
  using (user_id = auth.uid() or public.is_shop_member(shop_id, array['owner']) or public.is_super_admin());
create policy "members: super writes" on public.shop_members for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

create policy "payments: owner or super reads" on public.payments for select to authenticated
  using (public.is_shop_member(shop_id, array['owner']) or public.is_super_admin());
-- Inserts happen only inside record_payment().

-- ── Shop content: public reads while live, managers write ───────────────────
create policy "shop_profile: public reads live" on public.shop_profile for select
  using (public.shop_is_live(shop_id) or public.can_manage_shop(shop_id));
create policy "shop_profile: managers update" on public.shop_profile for update to authenticated
  using (public.can_manage_shop(shop_id)) with check (public.can_manage_shop(shop_id));

create policy "locations: public reads live" on public.locations for select
  using (public.shop_is_live(shop_id) or public.can_manage_shop(shop_id));
create policy "locations: managers write" on public.locations for all to authenticated
  using (public.can_manage_shop(shop_id)) with check (public.can_manage_shop(shop_id));

create policy "services: public reads active" on public.services for select
  using ((is_active and public.shop_is_live(shop_id)) or public.can_manage_shop(shop_id));
create policy "services: managers write" on public.services for all to authenticated
  using (public.can_manage_shop(shop_id)) with check (public.can_manage_shop(shop_id));

create policy "staff: public reads active" on public.staff for select
  using ((is_active and public.shop_is_live(shop_id)) or public.is_shop_member(shop_id) or public.is_super_admin());
create policy "staff: managers write" on public.staff for all to authenticated
  using (public.can_manage_shop(shop_id)) with check (public.can_manage_shop(shop_id));

create policy "staff_services: public reads live" on public.staff_services for select
  using (public.shop_is_live(shop_id) or public.can_manage_shop(shop_id));
create policy "staff_services: managers write" on public.staff_services for all to authenticated
  using (public.can_manage_shop(shop_id)) with check (public.can_manage_shop(shop_id));

create policy "working_hours: public reads live" on public.working_hours for select
  using (public.shop_is_live(shop_id) or public.can_manage_shop(shop_id));
create policy "working_hours: managers write" on public.working_hours for all to authenticated
  using (public.can_manage_shop(shop_id)) with check (public.can_manage_shop(shop_id));

create policy "blocked_dates: public reads live" on public.blocked_dates for select
  using (public.shop_is_live(shop_id) or public.can_manage_shop(shop_id));
create policy "blocked_dates: managers write" on public.blocked_dates for all to authenticated
  using (public.can_manage_shop(shop_id)) with check (public.can_manage_shop(shop_id));

create policy "gallery: public reads live" on public.gallery_photos for select
  using (public.shop_is_live(shop_id) or public.can_manage_shop(shop_id));
create policy "gallery: managers write" on public.gallery_photos for all to authenticated
  using (public.can_manage_shop(shop_id)) with check (public.can_manage_shop(shop_id));

create policy "posts: public reads live" on public.posts for select
  using (public.shop_is_live(shop_id) or public.can_manage_shop(shop_id));
create policy "posts: managers write" on public.posts for all to authenticated
  using (public.can_manage_shop(shop_id)) with check (public.can_manage_shop(shop_id));

create policy "social_links: public reads live" on public.social_links for select
  using (public.shop_is_live(shop_id) or public.can_manage_shop(shop_id));
create policy "social_links: managers write" on public.social_links for all to authenticated
  using (public.can_manage_shop(shop_id)) with check (public.can_manage_shop(shop_id));

-- ── Private shop data ───────────────────────────────────────────────────────
create policy "whatsapp_templates: managers all" on public.whatsapp_templates for all to authenticated
  using (public.can_manage_shop(shop_id)) with check (public.can_manage_shop(shop_id));

create policy "device_tokens: own tokens" on public.device_tokens for all to authenticated
  using (user_id = auth.uid() and public.is_shop_member(shop_id))
  with check (user_id = auth.uid() and public.is_shop_member(shop_id));

-- Any member (staff included) sees the shop's bookings and customers;
-- owners/managers change them. No anon policy: the public never reads these.
create policy "customers: members read" on public.customers for select to authenticated
  using (public.is_shop_member(shop_id) or public.is_super_admin());
create policy "customers: managers write" on public.customers for all to authenticated
  using (public.can_manage_shop(shop_id)) with check (public.can_manage_shop(shop_id));

create policy "appointments: members read" on public.appointments for select to authenticated
  using (public.is_shop_member(shop_id) or public.is_super_admin());
create policy "appointments: members update" on public.appointments for update to authenticated
  using (public.is_shop_member(shop_id) or public.is_super_admin())
  with check (public.is_shop_member(shop_id) or public.is_super_admin());
create policy "appointments: managers delete" on public.appointments for delete to authenticated
  using (public.can_manage_shop(shop_id));

-- ── Storage: one public bucket, a folder per shop ("<shop_id>/gallery/x.jpg")
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shop-media', 'shop-media', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

create policy "shop-media: managers upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'shop-media' and public.can_manage_shop_folder((storage.foldername(name))[1]));
create policy "shop-media: managers update" on storage.objects for update to authenticated
  using (bucket_id = 'shop-media' and public.can_manage_shop_folder((storage.foldername(name))[1]));
create policy "shop-media: managers delete" on storage.objects for delete to authenticated
  using (bucket_id = 'shop-media' and public.can_manage_shop_folder((storage.foldername(name))[1]));
