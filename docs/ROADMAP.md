# Roadmap

Status as of 2026-11-11: phases 1–4 are built. Everything below is checked by `npm run typecheck`, `npm run lint`, `npm test` and `npm run build`. **Nothing has run against a real Supabase project yet.** Create one (see README) and try the signup → dashboard → booking flow end to end first.

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
- [x] Receipt link with a secret token; "my bookings" saved on the customer's device
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
- [x] Landing, pricing (from your plans), login
- [x] `/signup` is an order form only (saved to `shop_requests`); only the super admin creates shops (`/super/shops/new`, or from an order in `/super/requests`)
- [x] `/super`: overview (shops by status, income this month, expiring this week)
- [x] Shops list and search, shop detail, record payment, extend trial, suspend, cancel
- [x] Plans editor (you create them), platform settings (trial days, grace days, support WhatsApp)

## 🔜 Phase 5: Apps and notifications
- [x] Capacitor Android + iOS projects generated, Tauri Windows project with icons
- [ ] Set the live URL and build: Android (Android Studio), iOS (Mac or cloud), Windows (Rust)
- [ ] Push to owners on new bookings: FCM; port zhewar `lib/pushNotifications.ts`, save to `device_tokens`
- [ ] Windows notifications (tauri-plugin-notification) or web push in the browser
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

- [ ] Home screen: list of all active shops (not suspended/cancelled) with logo, name, rating; filter by type: هەموو / سەرتاشخانە / ئارایشتگای خانمان, and search by name. No city filter: launch is Sulaimani only (add `shops.city` later when other cities join)
- [x] «پیشاندان لە ئەپ» switch: `shops.listed` (default on), switch in Dashboard → Settings; `/super` shop page can hide a shop from the app. Hidden shops still work by link/QR
- [ ] Shop page inside the app: same content as `/s/<slug>`, readable without an account
- [ ] Customer accounts with Supabase Auth: **phone number + password**. Browsing needs no account; **an account is required only to book.**
  - Signup and "forgot password" verify the phone with a 6-digit code sent over **WhatsApp (Meta WhatsApp Cloud API)**, through Supabase's *Send SMS* auth hook (no Twilio).
  - Normal login is phone + password, so it sends no message and costs nothing.
  - Needs: Meta Business account, WhatsApp Business number, an approved *authentication* message template (Kurdish), access token stored as a secret.
  - Cost: about $0.008 per code in Iraq (check Meta's live rate card); SMS fallback can be added later for customers without WhatsApp.
- [x] Link the account to the `customers` row of each shop it books at (`customers.user_id`, `0008`)
- [x] RLS: a customer reads only their own appointments, in every shop; `customers` and `appointments` stay non-public otherwise
- [ ] Booking flow asks for login at the moment of booking (keeps the chosen service/staff/time through signup), both on `/s/<slug>/book` and in the app; `book/actions.ts` takes the customer from the session, not from the form
- [ ] "My bookings": history across all shops, with status (چاوەڕوان / پەسەندکراوە / هەڵوەشاوە / تەواوبوو / نەهات)
- [ ] Customer cancels their own upcoming booking
- [ ] Open a shop by link/QR, saved favourite shops
- [ ] **Block a customer** (per shop) — *done on the shop side*: database rule, Block/Unblock in the bookings list (shown for no-shows and after 2+ no-shows), blocked badge, clear message on the booking page. Still needed: the customer app side. owner blocks a customer account from the booking list; a blocked customer can't book at that shop (checked in `book/actions.ts` and by the database). The dashboard suggests blocking after 2–3 no-shows (نەهات). Unblock any time
- [ ] **Ratings & reviews** — *done on the shop side*: Dashboard → Reviews (reply once), rating + reviews on the public shop page, hide/show in `/super`. Still needed: the writing screen in the customer app. only for a booking marked تەواوبوو, one per booking, 1–5 stars + optional text. Average and count on the shop card and shop page. The owner can reply once; `/super` can hide abusive reviews (owners can't delete reviews)
- [ ] Push to customers when status changes (confirmed, declined, reminder)
- [ ] Capacitor project for the customer app, its own icon, splash and store listing
- [ ] Move the device-saved "my bookings" and receipt tokens over to the account

## 🔜 Phase 7: Next features
- [x] **Block hours by hand**: the owner closes part of a day (e.g. 3:00–4:00), for the whole shop or one staff member (`0007_blocked_hours.sql`, Schedule → closed days and hours)
- [ ] **Waitlist**: when a day is full, a logged-in customer joins the waitlist for that day (and optional service/staff). When a booking is cancelled, everyone waiting gets a push; the first to book gets the slot (no holding). Needs customer accounts and push first
- [ ] Password reset for owners (Supabase email + `/auth/callback` + new-password page)
- [ ] Staff accounts: invite a barber/stylist to log in with role `staff`
- [ ] Choose which staff do which service (`staff_services` exists; needs an editor)
- [ ] Per-staff working hours and days off (the tables support it; needs an editor)
- [ ] Post preview: paste a link, auto-fill the image (port zhewar `app/api/fb-preview` with its SSRF guard)
- [ ] Optional face scan and Facebook link at booking (zhewar features), as shop settings
- [ ] Booking rate limit by IP (Upstash, like zhewar); today it's 3 future bookings per phone
- [ ] Reminder the day before (WhatsApp link list, or SMS later)
- [ ] Old-photo cleanup job for storage (zhewar `scripts/cleanup-orphan-storage.mts`)
- [ ] Security headers / CSP like zhewar `next.config.js`
- [ ] Online payment: FIB or ZainCash API → `record_payment` automatically
- [ ] Shops' own domains (`shops.custom_domain` exists; needs Vercel Domains API + proxy lookup)
- [x] **Three languages: Kurdish Sorani (default), Arabic, English.** Dictionaries in `lib/i18n/dictionaries`, pages under `app/[lang]`, `/ar/…` and `/en/…` URLs, picker on the platform header, shop page, dashboard and `/super`, per-language digits/dates/times, Kurdish and Arabic fonts. Arabic and English texts need a review by a native speaker
- [ ] Customer app: language picker (it remembers the choice like the website does)
- [ ] Optional Arabic/English fields for shop content the owner types (service names, about)
- [ ] Stats for owners (bookings per week, top services, no-shows)
