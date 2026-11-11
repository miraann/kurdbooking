import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { readFileSync } from 'node:fs';

// Applies supabase/migrations to an in-memory Postgres 17 (PGlite) with
// stand-ins for Supabase's auth/storage schemas, then checks the security
// rules and business functions. Run: npm run test:db
const MIG = new URL('../migrations/', import.meta.url);
const db = new PGlite({ extensions: { btree_gist } });

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  ok   ', name); }
  else { fail++; console.log('  FAIL ', name, extra); }
};
async function expectError(name, sql, params, codeOrText) {
  try { await db.query(sql, params); ok(name, false, '(no error)'); }
  catch (e) {
    const hit = String(e.code) === codeOrText || String(e.message).includes(codeOrText);
    ok(name, hit, `(got ${e.code}: ${e.message})`);
  }
}
async function as(role, uid) {
  await db.exec('reset role');
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid ?? '']);
  if (role) await db.exec(`set role ${role}`);
}

// ── Supabase stand-ins ──────────────────────────────────────────────────────
await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'),1)-1] $$;
  grant usage on schema storage to anon, authenticated, service_role;
  grant all on storage.objects to authenticated;
`);

for (const f of ['0001_platform.sql', '0002_shop_content.sql', '0003_booking.sql', '0004_functions.sql', '0005_rls.sql']) {
  try { await db.exec(readFileSync(new URL(f, MIG), 'utf8')); console.log('applied', f); }
  catch (e) { console.log('MIGRATION FAILED', f, e.message, e.position ?? ''); process.exit(1); }
}

// ── Data ───────────────────────────────────────────────────────────────────
const users = {};
for (const n of ['ali', 'sara', 'miran']) {
  const r = await db.query(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
    [`${n}@x.com`, JSON.stringify({ full_name: n, phone: '07701234567' })]);
  users[n] = r.rows[0].id;
}
const prof = await db.query(`select count(*)::int c from public.profiles`);
ok('profiles created by trigger', prof.rows[0].c === 3);

const mk = async (u, name, slug, kind) =>
  (await db.query(`select public.create_shop_for_owner($1,$2,$3,$4,$5,$6) id`, [u, name, slug, kind, name, '07701234567'])).rows[0].id;
const shopA = await mk(users.ali, 'Ali Barber', 'ali-barber', 'barber');
const shopB = await mk(users.sara, 'Sara Beauty', 'sara', 'salon');
ok('shops created', !!shopA && !!shopB);
await expectError('duplicate slug rejected', `select public.create_shop_for_owner($1,'x','ali-barber','barber','x','1')`, [users.miran], 'slug_taken');
await expectError('reserved slug rejected', `select public.create_shop_for_owner($1,'x','admin','barber','x','1')`, [users.miran], 'slug_taken');
await expectError('bad slug rejected', `select public.create_shop_for_owner($1,'x','A_B','barber','x','1')`, [users.miran], 'slug_taken');

const defaults = await db.query(`select
  (select count(*)::int from public.working_hours where shop_id=$1) wh,
  (select count(*)::int from public.staff where shop_id=$1) st,
  (select count(*)::int from public.whatsapp_templates where shop_id=$1) wt,
  (select count(*)::int from public.shop_members where shop_id=$1) m,
  (select status from public.shops where id=$1) status,
  (select trial_ends_at > now() + interval '13 days' from public.shops where id=$1) trial`, [shopA]);
const d = defaults.rows[0];
ok('defaults: 7 hours, 1 staff, 3 templates, owner, trial 14d', d.wh === 7 && d.st === 1 && d.wt === 3 && d.m === 1 && d.status === 'trial' && d.trial, JSON.stringify(d));

// ── Tenant isolation as Ali ────────────────────────────────────────────────
await as('authenticated', users.ali);
const myShops = await db.query(`select id from public.shops`);
ok('ali sees only his shop', myShops.rows.length === 1 && myShops.rows[0].id === shopA);
const upd = await db.query(`update public.shops set status='active' where id=$1`, [shopA]);
ok('ali cannot change his own status', upd.affectedRows === 0);
await db.query(`insert into public.services (shop_id, name, duration_minutes, price_iqd) values ($1,'Haircut',30,10000)`, [shopA]);
ok('ali adds a service to his shop', true);
await expectError('ali cannot add a service to Sara', `insert into public.services (shop_id, name) values ($1,'x')`, [shopB], 'row-level security');
const sarasCustomers = await db.query(`select * from public.customers where shop_id=$1`, [shopB]);
ok('ali reads none of Sara\'s customers', sarasCustomers.rows.length === 0);
await expectError('ali cannot make himself super admin', `update public.profiles set is_super_admin=true where id=$1`, [users.ali], 'permission denied');
await db.query(`update public.profiles set full_name='Ali K' where id=$1`, [users.ali]);
ok('ali can rename himself', true);
await expectError('ali cannot record a payment', `select public.record_payment($1,null,1,10000,'cash')`, [shopA], 'forbidden');
await db.query(`insert into storage.objects (bucket_id, name) values ('shop-media', $1)`, [`${shopA}/gallery/a.jpg`]);
ok('ali uploads into his folder', true);
await expectError('ali cannot upload into Sara\'s folder', `insert into storage.objects (bucket_id, name) values ('shop-media', $1)`, [`${shopB}/gallery/a.jpg`], 'row-level security');
await expectError('ali cannot upload with junk path', `insert into storage.objects (bucket_id, name) values ('shop-media', 'not-a-uuid/a.jpg')`, [], 'row-level security');

// ── Public (anon) ──────────────────────────────────────────────────────────
await as('anon');
const pub = await db.query(`select * from public.shop_by_slug('ali-barber')`);
ok('anon looks up a shop by slug', pub.rows[0]?.is_live === true && pub.rows[0]?.name === 'Ali Barber');
const pubSvc = await db.query(`select name from public.services where shop_id=$1`, [shopA]);
ok('anon reads live shop services', pubSvc.rows.length === 1);
await expectError('anon cannot read customers', `select * from public.customers`, [], 'permission denied');
await expectError('anon cannot read shops table', `select * from public.shops`, [], 'permission denied');
await expectError('anon cannot write services', `insert into public.services (shop_id, name) values ($1,'x')`, [shopA], 'permission denied');

// ── Booking rules (server / secret key = superuser here) ───────────────────
await as(null);
const staffA = (await db.query(`select id from public.staff where shop_id=$1`, [shopA])).rows[0].id;
const staffB = (await db.query(`select id from public.staff where shop_id=$1`, [shopB])).rows[0].id;
const cust = (await db.query(`insert into public.customers (shop_id, full_name, phone) values ($1,'Customer','9647701112233') returning id`, [shopA])).rows[0].id;
const book = (start, end, status = 'pending', staff = staffA) => db.query(
  `insert into public.appointments (shop_id, customer_id, staff_id, duration_minutes, starts_at, ends_at, status)
   values ($1,$2,$3,30,$4,$5,$6) returning id`, [shopA, cust, staff, start, end, status]);
await book('2030-01-01 10:00+03', '2030-01-01 10:30+03');
ok('first booking saved', true);
await expectError('overlapping booking rejected', `insert into public.appointments (shop_id, customer_id, staff_id, duration_minutes, starts_at, ends_at)
   values ($1,$2,$3,30,'2030-01-01 10:15+03','2030-01-01 10:45+03')`, [shopA, cust, staffA], '23P01');
await book('2030-01-01 10:30+03', '2030-01-01 11:00+03');
ok('back-to-back booking allowed', true);
await book('2030-01-01 10:00+03', '2030-01-01 10:30+03', 'cancelled');
ok('cancelled booking does not block', true);
await expectError('booking with another shop\'s staff rejected', `insert into public.appointments (shop_id, customer_id, staff_id, duration_minutes, starts_at, ends_at)
   values ($1,$2,$3,30,'2030-02-01 10:00+03','2030-02-01 10:30+03')`, [shopA, cust, staffB], '23503');
const svc = (await db.query(`select id from public.services where shop_id=$1`, [shopA])).rows[0].id;
await db.query(`update public.appointments set service_id=$1 where shop_id=$2`, [svc, shopA]);
await db.query(`delete from public.services where id=$1`, [svc]);
const kept = await db.query(`select count(*)::int c from public.appointments where shop_id=$1 and service_id is null`, [shopA]);
ok('deleting a service keeps its bookings', kept.rows[0].c === 3);

// ── Super admin, payments, status job ──────────────────────────────────────
await db.query(`update public.profiles set is_super_admin=true where id=$1`, [users.miran]);
await as('authenticated', users.miran);
const allShops = await db.query(`select id from public.shops`);
ok('super sees all shops', allShops.rows.length === 2);
await db.query(`insert into public.plans (name, price_iqd) values ('Basic', 25000)`);
ok('super creates a plan', true);
const pay = await db.query(`select (public.record_payment($1,null,1,25000,'fib','REF1')).*`, [shopA]);
ok('super records a payment', pay.rows[0]?.months === 1);
await as(null);
const afterPay = (await db.query(`select status, paid_until > trial_ends_at + interval '27 days' extended from public.shops where id=$1`, [shopA])).rows[0];
ok('payment → active, starts after trial', afterPay.status === 'active' && afterPay.extended, JSON.stringify(afterPay));

await db.query(`update public.shops set trial_ends_at = now() - interval '2 days' where id=$1`, [shopB]);
await db.query(`select public.refresh_shop_statuses()`);
ok('trial over → past_due', (await db.query(`select status from public.shops where id=$1`, [shopB])).rows[0].status === 'past_due');
await db.query(`update public.shops set trial_ends_at = now() - interval '9 days' where id=$1`, [shopB]);
await db.query(`select public.refresh_shop_statuses()`);
ok('past grace → suspended', (await db.query(`select status from public.shops where id=$1`, [shopB])).rows[0].status === 'suspended');
ok('paid shop untouched', (await db.query(`select status from public.shops where id=$1`, [shopA])).rows[0].status === 'active');
await as('anon');
ok('suspended shop: not live', (await db.query(`select is_live from public.shop_by_slug('sara')`)).rows[0].is_live === false);
ok('suspended shop: content hidden', (await db.query(`select * from public.staff where shop_id=$1`, [shopB])).rows.length === 0);
await as('authenticated', users.miran);
await db.query(`select public.extend_trial($1, 7)`, [shopB]);
await as(null);
ok('extend_trial brings it back', (await db.query(`select status from public.shops where id=$1`, [shopB])).rows[0].status === 'trial');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
