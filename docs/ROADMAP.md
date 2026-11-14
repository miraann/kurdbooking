# Roadmap

Status as of 2026-11-14: phases 1–4 are built and live on Vercel (https://kurdbooking-dlpz.vercel.app) with every migration applied to the live Supabase project. Everything below is checked by `npm run typecheck`, `npm run lint`, `npm test` and `npm run build`.

## ✅ Phase 1: Foundation
- [x] Next.js 16 project (Cache Components, Turbopack, Tailwind 4, Kurdish font, RTL)
- [x] Database: platform tables, shop content, bookings, RLS, storage bucket, functions, hourly status job
- [x] Database tests on in-memory Postgres (38 checks), plus slot unit tests
- [x] Shop routing: `/s/<slug>` now, `<slug>.<domain>` once `NEXT_PUBLIC_ROOT_DOMAIN` is set (`proxy.ts`)
- [x] Login with Supabase Auth, session refresh in the proxy, data access layer in `lib/auth.ts`

## ✅ Phase 2: Public shop page (zhewar style)
- [x] Home: hero with the ring, services, staff, gallery, social posts, about, hours, contact, social links, locations with map
- [x] Booking: service → staff (or "anyone") → day → free times → name and phone → receipt
- [x] Free-time calculation: hours, breaks, days off, notice, max days ahead, existing bookings, per-staff hours
- [x] Receipt link with a secret token (the device-saved "my bookings" list was replaced by customer profiles, Phase 6)
- [x] Closed page for suspended shops

## ✅ Phase 3: Owner dashboard (zhewar admin style)
- [x] Today, pending count, QR code + link
- [x] Bookings: upcoming / pending / past; confirm, decline, done, no-show; call; WhatsApp with templates
- [x] Services, staff, gallery, posts, social links, locations, days off, WhatsApp templates (`ResourceEditor`)
- [x] Weekly hours with breaks
- [x] Branding (name, logo, cover, colours) and contact numbers
- [x] Booking settings (on/off, auto-confirm, interval, notice, days ahead)
- [x] Subscription page with plans, payment history, WhatsApp to you
- [x] Plan limits on staff, photos and locations

## ✅ Phase 4: Platform + super admin
- [x] Login (the landing and `/pricing` pages were removed on 2026-11-14: the home page is the customer shop list and prices are never public)
- [x] `/signup` is an order form only (saved to `shop_requests`); only the super admin creates shops (`/super/shops/new`, or from an order in `/super/requests`)
- [x] `/super`: overview (shops by status, income this month, expiring this week)
- [x] Shops list and search, shop detail, record payment, extend trial, suspend, cancel
- [x] Plans editor (you create them), platform settings (trial days, grace days, support WhatsApp)

## 🔜 Phase 5: Apps and notifications
- [x] Capacitor Android + iOS projects generated, Tauri Windows project with icons
- [x] Live URL set in `native/mobile/capacitor.config.ts` (https://kurdbooking-dlpz.vercel.app)
- [x] Build Android: signed APK + Play bundle (`native/README.md`). The shell keeps the page clear of the system bars (targetSdk 36 is edge to edge), the back key goes back a page, cookies are saved on pause, icon and launch screen come from `native/icon.svg`
- [ ] Build: iOS (Mac or cloud), Windows (Rust)
- [ ] Google Play listing ($25 once): upload `app-release.aab`, keep Play App Signing on
- [ ] Battery/autostart helper so booking pushes reach swiped-away apps on Xiaomi, Samsung, Huawei… (port zhewar's `BackgroundReliabilityPlugin` + a dashboard settings card)
- [x] Push to owners/managers (and the booked staff member) on new bookings: browser push + Android app (FCM, Firebase project `kurdbooking`, `google-services.json` in `native/mobile/android/app`). Needs `FIREBASE_SERVICE_ACCOUNT` on Vercel for the app
- [ ] iOS push: needs an Apple Developer account, then an APNs key uploaded to Firebase and `GoogleService-Info.plist`
- [x] Browser push (Web Push, `lib/push.ts`, `public/sw.js`, tables `push_subscriptions` / `push_keys`): the super admin gets an alert for each new `/signup` order
- [ ] Windows notifications (tauri-plugin-notification), or reuse the browser push above for owners
- [ ] Notification sound choice (zhewar `notification_sound`)
- [ ] Final app icon and splash

## 🔜 Phase 6: Customer app (Android + iOS)
A separate app for customers (not the owner `/dashboard` app in `native/mobile`).

**Flow:** open the app → list of shops (no login) → filter **Barbershops / Women's salons** → open any shop page and browse freely → tap *Book* → only now sign up or log in with phone number → finish the booking.

- [x] **Database groundwork** (`0008_customer_app.sql`, tested in `supabase/tests/db.test.mjs`, applied live):
  - `shops.listed` (owner switch, `set_shop_listed()`) and `shops.hidden_by_admin` (`/super`); `listed_shops(kind, search)` for the app home list, with rating
  - `customers.user_id` (only the server links it), `customers.blocked_at` with a trigger that refuses bookings for blocked customers
  - `my_appointments()` and `cancel_my_appointment()` for the logged-in customer
  - `reviews` with `submit_review()`, `reply_to_review()`, `set_review_hidden()`, and public `shop_rating()` / `shop_reviews()`

- [x] **Web shops list** in zhewar red/blue, now the site's home page `/` (`/shops` redirects there); booking and the receipt restyled to match zhewar
- [x] Home screen in the app: the site's home page `/` (all listed live shops with logo, name, rating; filter هەموو / سەرتاشخانە / ئارایشتگای خانمان; search by name). No city filter: launch is Sulaimani only (add `shops.city` later when other cities join)
- [x] «پیشاندان لە ئەپ» switch: `shops.listed` (default on), switch in Dashboard → Settings; `/super` shop page can hide a shop from the app. Hidden shops still work by link/QR
- [x] Shop page inside the app: the same `/s/<slug>`, readable without an account
- [x] Customer accounts with Supabase Auth: **phone number + password** (2026-11-14). Browsing needs no account; **a profile is required only to book.** `/account` signs up / logs in. Supabase has no phone login without an SMS provider, so the login is a stand-in email `<phone>@phone.invalid` (undeliverable) and the phone sits in `app_metadata` (`lib/customer.ts`).
- [ ] Verify the phone (until then anyone can register any number, and a forgotten customer password can't be reset):
  - Signup and "forgot password" verify the phone with a 6-digit code sent over **WhatsApp (Meta WhatsApp Cloud API)**, through Supabase's *Send SMS* auth hook (no Twilio).
  - Normal login is phone + password, so it sends no message and costs nothing.
  - Needs: Meta Business account, WhatsApp Business number, an approved *authentication* message template (Kurdish), access token stored as a secret.
  - Cost: about $0.008 per code in Iraq (check Meta's live rate card); SMS fallback can be added later for customers without WhatsApp.
- [x] Link the account to the `customers` row of each shop it books at (`customers.user_id`, `0008`)
- [x] RLS: a customer reads only their own appointments, in every shop; `customers` and `appointments` stay non-public otherwise
- [x] Booking flow asks for a profile at the moment of booking (the last step signs up / logs in in place and keeps the chosen service/staff/time); `book/actions.ts` takes the customer from the session, not from the form
- [x] "My bookings" in `/account`: upcoming and past bookings across all shops, with status (چاوەڕوان / پەسەندکراوە / هەڵوەشاوە / تەواوبوو / نەهات), each opening its receipt
- [x] Customer cancels their own upcoming booking (`cancel_my_appointment`, push to the shop)
- [ ] Open a shop by link/QR in the app (Android App Links)
- [x] **Favourite shops** (`0013_favorites.sql`): heart on the shop page, «دوکانە دڵخوازەکانم» in `/account` and at the top of the home page
- [ ] **Block a customer** (per shop) — *done on the shop side*: database rule, Block/Unblock in the bookings list (shown for no-shows and after 2+ no-shows), blocked badge, clear message on the booking page. Still needed: the customer app side. owner blocks a customer account from the booking list; a blocked customer can't book at that shop (checked in `book/actions.ts` and by the database). The dashboard suggests blocking after 2–3 no-shows (نەهات). Unblock any time
- [x] **Ratings & reviews**: the customer rates a booking marked تەواوبوو from `/account` (once, 1–5 stars + optional text; the shop gets a push). Dashboard → Reviews (reply once), rating + reviews on the public shop page and the shop list, hide/show in `/super`. Owners can't delete reviews
- [x] **Push to customers** (`lib/customer-push.ts`): confirmed, declined, cancelled by the shop, «rate your visit» after تەواوبوو, and a reminder the day before (`/api/cron/reminders`, daily Vercel cron, `0014_reminders.sql`). Works in browsers (alerts card in `/account`); the customer Android app needs its own Firebase registration first (see Phase 5)
- [x] Capacitor project for the customer app: `native/customer` (`com.kurdbooking.app`, opens `/`, blue→red icon), signed APK served at `/kurdbooking.apk` with a download link on the customer pages (browsers only)
- [ ] Customer app: final icon (Android 7 still shows the owner app's indigo PNGs), iOS project, store listing
- [x] Device-saved "my bookings" removed (`/s/<slug>/my-bookings` redirects to `/account`)

## 🔜 Phase 7: Next features
- [x] **Block hours by hand**: the owner closes part of a day (e.g. 3:00–4:00), for the whole shop or one staff member (`0007_blocked_hours.sql`, Schedule → closed days and hours)
- [ ] **Waitlist**: when a day is full, a logged-in customer joins the waitlist for that day (and optional service/staff). When a booking is cancelled, everyone waiting gets a push; the first to book gets the slot (no holding). Needs customer accounts and push first
- [x] **Password reset**: `/forgot-password` emails a link; `/super` → shop → «Owner's password» makes a one-time link to send on WhatsApp (no email needed); both open `/auth/confirm` → `/reset-password`. Logged in: Settings → change password (asks for the current one; dashboard and `/super`). Real emails to owners need SMTP in Supabase (README → Setup step 6)
- [x] **Staff logins** (`0015_staff_logins.sql`): Staff → the person → «چوونەژوورەوە»: the owner or a manager makes an email + password (copy / WhatsApp), a one-time reset link, or removes it (deleting the staff member removes it too). Staff logins see Home, Bookings (with «تەنها هی من») and Settings (alerts, password) only, and get pushes for their own bookings. Only the server links `staff.user_id`
- [x] **Which staff do which service**: Staff → «خزمەتگوزاری و کاتی کار» (`/dashboard/staff/<id>`); all on = every service, new ones too
- [x] **Per-staff working hours** on the same page (own week, or back to the shop's hours); per-staff days off and closed hours are in Schedule («بۆ کێ»)
- [ ] Post preview: paste a link, auto-fill the image (port zhewar `app/api/fb-preview` with its SSRF guard)
- [ ] Optional face scan and Facebook link at booking (zhewar features), as shop settings
- [x] **Rate limits** in the database instead of Upstash (`0012_rate_limits.sql`, `lib/rate-limit.ts`): bookings 8 per IP per 10 min, `/signup` orders 5 per hour, both logins 10 per 10 min, reset emails 5 per hour, password change 5 per 10 min per account. Plus the old rule: 3 future bookings per phone
- [x] **Reminder the day before**: push to customers (above), plus Bookings → «سبەی» in the dashboard with a WhatsApp reminder button per customer (SMS later)
- [ ] Old-photo cleanup job for storage (zhewar `scripts/cleanup-orphan-storage.mts`)
- [x] **Security headers**: CSP (scripts, frames and connections only from our site, images from Supabase Storage), HSTS, nosniff, frame and referrer rules (`next.config.ts`)
- [ ] Online payment: FIB or ZainCash API → `record_payment` automatically
- [ ] Shops' own domains (`shops.custom_domain` exists; needs Vercel Domains API + proxy lookup)
- [x] **Three languages: Kurdish Sorani (default), Arabic, English.** Dictionaries in `lib/i18n/dictionaries`, pages under `app/[lang]`, `/ar/…` and `/en/…` URLs, picker on the platform header, shop page, dashboard and `/super`, per-language digits/dates/times, Kurdish and Arabic fonts. Arabic and English texts need a review by a native speaker
- [x] Customer app: language picker in the header of the shop list (the `kb_lang` cookie keeps the choice, like the website)
- [ ] Optional Arabic/English fields for shop content the owner types (service names, about)
- [ ] Stats for owners (bookings per week, top services, no-shows)
