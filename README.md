# KurdBooking

A booking system that many barbershops and women's salons can share.

- **Side 1, the seller platform.** Each shop signs up itself and starts on a free trial. You run `/super`, where you create plans, record payments, and extend or suspend shops.
- **Side 2, each shop.** The owner works in `/dashboard`: bookings, services, staff, hours, gallery, social posts, contact, locations and branding. Customers use the shop's public page to book, see the gallery and posts, and find the contact details and map.

It runs on the web, on Android and iOS (Capacitor), and on Windows (Tauri). All three apps open the same live dashboard. The look is the same as the zhewar project.

Project rules for Claude/VS Code are in [CLAUDE.md](CLAUDE.md). What's built and what's next is in [docs/ROADMAP.md](docs/ROADMAP.md).

---

## 1. Setup (first time)

### Supabase

1. Create a new project at [supabase.com](https://supabase.com), separate from zhewar's.
   - Pick the region nearest Iraq, for example Frankfurt (`eu-central-1`).
2. Go to **Database → Extensions** and enable **pg_cron**.
3. Open the **SQL Editor** and run each file in `supabase/migrations`, in order:
   `0001_platform.sql` → `0002_shop_content.sql` → `0003_booking.sql` → `0004_functions.sql` → `0005_rls.sql` → `0006_cron.sql`
4. Go to **Authentication → Sign In / Providers** and turn **off** "Allow new users to sign up".
   - The app creates accounts itself through the secret key, so this only blocks accounts made outside the app.
5. Go to **Project Settings → API Keys** and copy the URL, the **publishable** key and the **secret** key.

### Environment

```bash
copy .env.example .env.local
```

Fill in `.env.local`. Leave `NEXT_PUBLIC_ROOT_DOMAIN` empty until you buy the domain.

### Run

```bash
npm install
```

```bash
npm run dev
```

| URL | What |
|---|---|
| http://localhost:3000 | Platform landing |
| http://localhost:3000/signup | Register a shop (creates the owner account + trial) |
| http://localhost:3000/dashboard | Owner dashboard |
| http://localhost:3000/s/&lt;slug&gt; | The shop's public page |
| http://localhost:3000/super | Your super admin |

### Make yourself super admin

1. In Supabase, go to **Authentication → Users → Add user**. Enter your email and a password, and tick "Auto confirm".
2. Run this in the SQL Editor:

```sql
update public.profiles set is_super_admin = true
where id = (select id from auth.users where email = 'YOUR-EMAIL');
```

3. Log in at `/login`. It takes you to `/super`.
4. Create your plans in **پلانەکان**, and set the trial days, grace days and your WhatsApp number in **ڕێکخستن**.

---

## 2. How subscriptions work

1. **Trial.** A new shop gets the trial days from `/super/settings` (14 by default) and is live straight away.
2. **Payment.** When a shop pays (cash, FIB, ZainCash, FastPay, bank), open the shop in `/super/shops` and use **تۆمارکردنی پارەدان**.
   - The paid months start where the current period ends, so the shop never loses days.
   - The shop becomes **چالاک**.
3. **Expiry.** An hourly job (`refresh_shop_statuses`, pg_cron) handles shops whose time has ended:
   - When the time ends, the shop becomes **past due**. It still works, and the owner sees a "renew" banner.
   - After the grace days, the shop becomes **suspended**. The public page shows "not available" and booking stops. The owner can still log in.
4. **Bringing a shop back.** Record a payment, or use **درێژکردنەوەی تاقیکاری**.

Online payment (FIB / ZainCash APIs) is in the roadmap. Stripe doesn't work in Iraq.

---

## 3. Deploy (Vercel)

1. Push the project to GitHub and import it in Vercel.
2. Add the variables from `.env.local` in **Settings → Environment Variables**, and set `NEXT_PUBLIC_SITE_URL` to the Vercel address.
3. Deploy. Shops live at `https://<project>.vercel.app/s/<slug>` until you have a domain.

### When you buy the domain

1. In Vercel, go to **Settings → Domains** and add `kurdbooking.com` (or whatever you buy), `www.kurdbooking.com` and **`*.kurdbooking.com`**.
   - A wildcard domain needs the domain's **nameservers pointed at Vercel**. Vercel shows them.
2. Set these two variables, then redeploy:
   - `NEXT_PUBLIC_ROOT_DOMAIN=kurdbooking.com`
   - `NEXT_PUBLIC_SITE_URL=https://kurdbooking.com`
3. Every shop now also works at `https://<slug>.kurdbooking.com`. The old `/s/<slug>` links keep working.

**To test subdomains locally,** set `NEXT_PUBLIC_ROOT_DOMAIN=localhost:3000` and open `http://<slug>.localhost:3000`.

---

## 4. Apps (Android, iOS, Windows)

See [native/README.md](native/README.md). In short:

| App | Folder | Builds on | Store cost |
|---|---|---|---|
| Android | `native/mobile/android` | Windows, with Android Studio | Google Play $25 once |
| iOS | `native/mobile/ios` | A Mac with Xcode, or a cloud Mac (GitHub Actions / Codemagic) | Apple $99/year |
| Windows | `native/windows` | Windows, needs Rust | Installer (.exe / .msi); Microsoft Store optional |

The apps are thin shells around the live `/dashboard`, like zhewar's admin app. A web deploy updates all of them without a store release.

---

## 5. Checks

```bash
npm run typecheck
```

```bash
npm run lint
```

```bash
npm test
```

```bash
npm run build
```

`npm test` runs every migration on an in-memory Postgres 17 (PGlite) and checks 38 rules:
- tenant isolation
- RLS for anon, owners and super
- double-booking protection
- payments
- trial → past due → suspended
