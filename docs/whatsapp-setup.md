# WhatsApp verification codes (Meta WhatsApp Cloud API)

KurdBooking sends a 6-digit code over WhatsApp when a customer **creates a profile** and when they **forget their password**. Logging in with phone + password sends nothing and costs nothing.

The code is already built (`lib/whatsapp.server.ts`, `lib/phone-code.server.ts`, migration `0018_phone_codes.sql`). It stays **off** until the three secrets below are set. Until then signup works without a code, as before.

## What you do (once, about an hour, plus Meta's approval wait)

1. **Meta Business account**: <https://business.facebook.com> → create a business (use the real shop-platform name). Complete *Business verification* in Business settings → Security centre. Sending to real customers is limited until this is approved.
2. **App**: <https://developers.facebook.com/apps> → *Create app* → type **Business** → add the **WhatsApp** product, and attach it to your business account.
3. **Phone number**: WhatsApp → *API Setup* → *Add phone number*. Use a number that is **not** registered in the normal WhatsApp or WhatsApp Business app (or delete that account first). It receives the verification call or SMS once.
   - To test first, use the free **test number** Meta gives you: it can message up to 5 numbers you add as recipients, with no business verification.
4. **Message template** (WhatsApp Manager → *Message templates* → *Create template*):
   - Category **Authentication**
   - Name: `kurdbooking_code` (lower case, letters and `_`)
   - Language: **Arabic**. Meta has no Kurdish template language, and authentication templates have fixed wording, so Arabic is what people here read.
   - Code delivery: **Copy code**, tick *add security recommendation* if you like, expiry 10 minutes.
   - Submit. Authentication templates are usually approved within minutes.
5. **Permanent access token** (a temporary one dies in 24 h):
   - Business settings → Users → **System users** → *Add* (role Admin) → *Add assets* → your app (full control) and your WhatsApp account.
   - *Generate token* → app = yours → permissions `whatsapp_business_messaging` and `whatsapp_business_management` → **never expires**. Copy it once.
6. Copy the **Phone number ID** (WhatsApp → API Setup, under the number; it is *not* the phone number itself).
7. **Payment method**: WhatsApp Manager → *Payment settings*. Meta bills each authentication message to you (roughly a cent in Iraq: check the live rate card).

## Secrets

In `.env.local` (and on Vercel → Project → Settings → Environment Variables, then redeploy):

| Name | Value |
|---|---|
| `WHATSAPP_ACCESS_TOKEN` | the system-user token (step 5) |
| `WHATSAPP_PHONE_NUMBER_ID` | the Phone number ID (step 6) |
| `WHATSAPP_TEMPLATE_NAME` | `kurdbooking_code` (the template name, step 4) |
| `WHATSAPP_TEMPLATE_LANG` | optional, default `ar` (must match the template's language code) |
| `WHATSAPP_API_VERSION` | optional, default `v23.0` |

Never commit the token or put it in a `NEXT_PUBLIC_` variable.

## How it behaves

- Signup: name + phone + password → code arrives on WhatsApp → enter it → the profile is created and the customer is logged in.
- Forgot password (login tab): phone → code → new password → logged in. This also lets customers who signed up before verification existed recover their account.
- A code is valid 10 minutes, allows 5 guesses, and a new one can be sent once a minute.
- Cost guards (`lib/rate-limit.ts`): 10 codes per visitor per hour, 5 per phone per hour, 500 per day for the whole site. Raise `whatsappDaily` when the platform grows.
- New accounts get `app_metadata.phone_verified = true`. Nothing blocks unverified old accounts yet.

## Check it works

1. Set the secrets, run `npm run dev`, open `/account`.
2. Sign up with a number that can receive WhatsApp (with the test number: a recipient you added). You should get the code in a few seconds.
3. If no code arrives, the server log has `whatsapp send failed <status> <code> <message>`. Common ones: `190` token wrong or expired; `132001` template name/language doesn't match an approved template; `131030` the recipient isn't on the test number's allow-list; `131042` payment method missing.

## Later

- SMS fallback for customers without WhatsApp.
- Use the same sender for WhatsApp booking reminders (needs a *utility* template per message).
