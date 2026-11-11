@AGENTS.md

# KurdBooking — project rules

Multi-shop booking platform for barbershops and women's salons (Kurdistan). The UI is in Kurdish Sorani (default), Arabic and English.
It is the multi-tenant successor of `E:\zhewar` (single shop). That project stays separate,
but its look and its tested features are the reference.

Every page lives under `app/[lang]/` (see **Languages** below), so the folders are:

- **Side 1, seller platform:** landing, `/pricing` and `/signup` in `app/[lang]/(platform)`. The owner of the platform uses `/super` (`app/[lang]/super`).
  - `/signup` is only an order form: it saves a row in `shop_requests`, no account and no shop. **Only the super admin creates shops**, in `/super/shops/new` (or from an order in `/super/requests`).
  - **Two separate logins:** `/login` is for shop owners and staff, `/super/login` is for the super admin. Each refuses the other kind of account (`signIn()` in `app/[lang]/(platform)/auth-actions.ts`). `/super` pages live in `app/[lang]/super/(panel)/` so that `/super/login` is outside the admin check.
  - New orders send a browser push to the super admin (`lib/push.ts`, `public/sw.js`).
- **Side 2, each shop:**
  - The owner dashboard is `/dashboard` (`app/[lang]/dashboard`). The Android, iOS and Windows apps open this page.
  - The public shop page is `/s/<slug>` (`app/[lang]/s/[shop]`). Once a domain is set it is also `<slug>.<root-domain>`, through `proxy.ts`.
- **Customer side:** `/shops` (`app/[lang]/shops`) lists every live shop that is listed (`listed_shops()`, cached under `LISTED_SHOPS_TAG`), with a type filter and search. The customer app opens here, then `/s/<slug>`.

Setup and commands are in `README.md`. What is built and what is next is in `docs/ROADMAP.md`.

## Stack

| Part | What we use |
|---|---|
| Web app | Next.js 16 (App Router, Turbopack, **Cache Components on**), React 19, TypeScript, Tailwind 4 |
| Database | Supabase: Postgres, Auth, Storage. Migrations are in `supabase/migrations`, applied in order. |
| Android and iOS apps | Capacitor 8 (`native/mobile`). The app loads the live `/dashboard`. |
| Windows app | Tauri 2 (`native/windows`). It loads the live `/dashboard`. |

## Next.js 16 rules (they differ from older Next.js; read `node_modules/next/dist/docs/` when unsure)

- **Middleware is now `proxy.ts`.** It exports `proxy()` and `config` and nothing else.
- **`params` and `searchParams` are Promises.** Use the global `PageProps<"/route">`, `LayoutProps<"/route">` and `RouteContext<"/route">` types (`npm run typecheck` runs `next typegen` first).
- **Request data needs a boundary.** Cookies, headers, params, searchParams and the current time must be read inside `<Suspense>`.
  - Every page folder has a `loading.tsx` for this. A new page folder needs one too (copy any existing one-line `loading.tsx`).
  - Never read cookies at the top level of a layout. The layouts put that inside `<Suspense>` (`ShopGate`, `SuperGate`, `ShopFrame`).
  - A page that uses `new Date()` before any other request data must call `await connection()` first (see `app/[lang]/s/[shop]/book/page.tsx`).
- **Public shop data is cached** with `'use cache'` plus `cacheTag` in `lib/shop-data.ts`. After a dashboard change, Server Actions call `updateTag(shopTag(id))` and `refresh()`.
- **Check `npm run dev`.** Its overlay reports instant-navigation "Insights" and Issues. Fix them; don't ignore them.

## Data and security rules

- Every shop table has `shop_id`. **Every query filters by `shop_id`**, even though RLS also enforces it.
- **Logged-in code goes through `lib/auth.ts`:** `requireShop()`, `requireSuperAdmin()`, `requireUser()`. Every Server Action calls one of them first. Never trust a shop id sent by the browser.
- **Pick the right Supabase client:**
  - `lib/supabase/server.ts` acts as the user, so RLS applies. Use it by default.
  - `lib/supabase/public.ts` has no cookies, for `'use cache'` reads of public content.
  - `lib/supabase/admin.ts` uses the secret key and bypasses RLS. Use it only after an auth check, or for public booking and the `/signup` order form, and always filter by `shop_id` yourself.
- **`customers` and `appointments` are never public.** Bookings are written by `app/[lang]/s/[shop]/book/actions.ts`, which re-checks the slot. The database `appointments_no_overlap` constraint is the final guard.
- **Subscription status is changed only by `record_payment`, `extend_trial` and `refresh_shop_statuses`** (all in `0004_functions.sql`), or by the super admin.
- **To change the database:** add a new migration file (`0007_….sql`, never edit an applied one). Then add checks to `supabase/tests/db.test.mjs` and run `npm test`.

## Adding a list the owner manages (like services or gallery)

1. Add a table with `shop_id` in a new migration. Add RLS following the `0005_rls.sql` pattern, plus a test.
2. Add an entry to `RESOURCES` in `lib/resources.ts`: the fields, a title field, and an optional plan limit. Every label is `{ ckb, ar, en }`.
3. Create a page under `app/[lang]/dashboard/` that renders `<ResourceEditor resource="…" />`, plus its `loading.tsx`. Add it to `components/dashboard/links.ts`.

Single-record forms use `<FieldsForm>` with a field list from `lib/forms.ts`.

## Theme: the same look as E:\zhewar

The tokens and building blocks live in `app/globals.css` as Tailwind `@utility` classes:
`card`, `card-emphasized`, `btn-primary`, `btn-tonal`, `btn-ghost`, `btn-danger`, `btn-shop`, `btn-shop-accent`, `input`, `label`.

**Platform, dashboard and `/super`** follow zhewar's admin panel:
- indigo-600 → violet-600 gradient on main buttons
- `#FAFAFC` background (`bg-surface`)
- white `rounded-3xl` cards with the soft shadow (`shadow-md-1`)
- grey filled inputs
- `<Switch>` (`components/ui/Switch.tsx`) instead of checkboxes
- the floating pill tab bar on phones
- `.text-brand-gradient` for the keyword in a heading

**The customer side** (`/shops`, the public shop page, booking, my bookings, receipt) follows zhewar's home page, in red and blue.
Use the pieces in `components/shop/theme.tsx` (`ShopStrip`, `LogoRing`, `Divider`, `Heading`) and the `card-shop` / `input-shop` / `btn-shop` / `btn-shop-accent` utilities, never the indigo `card` / `input` / `btn-primary`:
- white background with `neutral-900` headings
- the logo in a rotating two-colour ring
- the accent → ✦ → primary divider
- section headings with a small spaced Latin eyebrow (SERVICES, GALLERY …)
- `rounded-3xl` image cards

Shop colours come from `--shop-primary` and `--shop-accent`, which default to zhewar's blue `#2563eb` and red `#ef4444`. Barbershops get the barber-pole strip; salons get a plain two-colour strip.

Use `lucide-react` icons. Version 1.x has **no brand icons**: show social platforms as text pills.

## Languages: Kurdish Sorani (default), Arabic, English

- **URLs:** Kurdish has no prefix (`/dashboard`), Arabic is `/ar/…`, English is `/en/…`. `proxy.ts` rewrites Kurdish URLs to `/ckb/…` inside, so every page is under `app/[lang]/`, and redirects `/ckb/…` to the clean URL. The `kb_lang` cookie (set by `<LanguageSwitcher>`) sends unprefixed links to the visitor's chosen language. `ckb` and `ar` are RTL; `en` is LTR.
- **Never write UI text straight into a page.** Add it to `lib/i18n/dictionaries/ckb.ts` **and** `ar.ts` and `en.ts` (TypeScript fails if one is missing). Config lists (`lib/labels.ts`, `lib/resources.ts`, `lib/forms.ts`, `components/dashboard/links.ts`) hold `{ ckb, ar, en }` inline.
- **How to get the language:**
  - Server Components: `const { lang, t, f, href } = await getI18n()` from `lib/i18n/server.ts` (reads the `[lang]` segment; stays static).
  - Client Components: `const { lang, t, f, href } = useI18n()` from `components/i18n/I18nProvider.tsx`.
  - Server Actions and Route Handlers: `await getActionI18n()` from `lib/i18n/request.ts` (reads the header proxy.ts sets). Pass `lang` to `parseFields()` and `userMessage()`.
- **Links and redirects:** always `href("/dashboard")`, never a bare `"/dashboard"`, so the language is kept. Login `next=` values are stored without the prefix.
- **Layout direction:** use logical classes (`ms-`, `pe-`, `start-`, `text-start`, `border-e`), not `ml-`/`right-`. Flip "forward" arrows with `ltr:rotate-180`.
- Shop content the owner types (service names, about…) is shown as typed, in any language.
- Fonts: Kurdish uses `public/font/kurdish.otf`; Arabic uses `public/font/Arabic.ttf` (switched on by `lang="ar"` through `:lang(ar)` in `globals.css`); English uses the Kurdish font's Latin letters. Don't add other font files.

## Kurdish (Sorani) wording
- A women's salon is **«ئارایشتگای خانمان»**, never «ساڵۆن». The shop owner is **never «سەرتاش»**: that word is for staff titles only.
- An appointment is «کاتی سەردانیکردن». Statuses: چاوەڕوان / پەسەندکراوە / هەڵوەشاوە / تەواوبوو / نەهات.
- Write پەیوەندی, not پێوەندی.
- **Numbers, prices, dates and times on screen** go through `f` (`fmt(lang)` in `lib/format.ts`): `f.num()`, `f.iqd()`, `f.time()` («٢:٣٠ دوا نیوەڕۆ» / «2:30 PM»), `f.date()`, `f.minutes()`, `f.days()`, `f.months()`. Kurdish and Arabic get ٠-٩ digits, English gets 0-9.
- **Phones are stored as `9647XXXXXXXXX`** (`normalizePhone`) and shown as `07XXXXXXXXX` (`displayPhone`), in an LTR span.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server (needs `.env.local`) |
| `npm run typecheck` | Route types + TypeScript |
| `npm run lint` | ESLint, React Compiler rules included |
| `npm test` | Slot-calculation unit tests, then all migrations and security checks on an in-memory Postgres |
| `npm run build` | Production build. It also enforces the Cache Components rules. |
