> Review branch: Halloween theming and draft legal acceptance are implemented locally. They are **not deployed**. See [review report](deploy/HALLOWEEN-LEGAL-REVIEW.md) before applying the additive migration or publishing draft policies.

# Toga

Peer-to-peer clothing rentals for college students. This launch is restricted to **Georgia Tech (`@gatech.edu`)**, with an explicit founder login exception for `jointoga@gmail.com`.

Next.js 15 / React 19, Prisma 6, Supabase Postgres, private Supabase Storage, and verified email signup, password login, and Resend transactional email. Production hostname: https://jointoga.com on the existing Vercel project. No in-app payments.

## Launch status

Production URL: **https://toga-ecru.vercel.app**. Vercel is connected to Supabase Postgres and private Storage; production migrations are applied. Hosted routing, database sessions, image upload/download and authorization, domain rejection, and the scheduled job's HTTP response passed verification. The original SendGrid rollout accepted the admin magic-link test, and the live mobile login form accepts the exact admin exception.

**Limited pilot:** production contains real student data. Never reset or empty it. See [domain, email, authentication and rollback operations](deploy/RESEND.md). Check the live config and release before operating on production.

The supplied original logo is stored unchanged in `public/logo.png` and used in the header, landing page, and browser/touch icons. Visible product naming is **Toga**, without a trailing period.

## Local development

Requires Node.js 22 and npm. On the current machine, the temporary runtime is `/tmp/node-v22.23.3-darwin-arm64/bin`; add it to `PATH` if Node is unavailable.

```sh
npm ci
cp .env.example .env  # only for a new checkout; don't overwrite configured values
npm run db:local     # leave running in its own terminal
```

In a second terminal:

```sh
npm run db:deploy
npm run dev
```

Open http://localhost:3000. The local development environment shows a test magic link after you enter a `@gatech.edu` address. Production never exposes that link. Opening an email link does not consume it until the user selects **Continue to Toga**, preventing email scanners from using it first.

`npm run db:local` runs development-only Postgres on `127.0.0.1:54322` and persists data in `.local-postgres`. Use another local Postgres instance by changing `DATABASE_URL` and `DIRECT_URL`. Application tables live in the private `toga` schema.

## Core flows

- Logged-out visitors see a minimal landing page with the exact description and one sign-up/login CTA. No stock photos, testimonials, or marketing sections.
- Onboarding requires a name and phone number. Year, payment information, and profile photo are optional.
- Browse offers tested category, size, maximum daily price, word-based search, and saved-item filters. Order is creation date descending, then ID descending. There is no pretend sort control.
- Listing creation is one form. Photos, title, category, size, price, condition, and a short description are required. Replacement value is optional. New listings are always active; no visibility or draft control.
- Uploads support multiple photos, drag-and-drop, the photo library, and a camera picker. Browser resizing keeps the upload below Vercel's request limit. The server decodes images, strips metadata, and stores WebP files.
- Sent and Received requests are separate. Lenders accept/decline; renters may cancel a pending request. Accepted rentals reveal phone numbers. Renters mark pickup and return. Both parties can add condition photos and ratings; reports go to the administrator.
- A pending request reserves the whole item. It expires after 48 hours. Return makes the listing available again. Reserved/rented listings cannot be edited or removed.
- Removing a listing archives it and keeps rental history. Archived listings disappear from My listings.
- Prices are daily, including pickup and return dates. The detail form shows the total; students arrange payment via Venmo/cash.

## Database and images

`prisma/schema.prisma` and `prisma/migrations` now target Postgres. The original SQLite schema/migrations are archived in `prisma/sqlite`; `prisma/dev.db` was preserved locally. Do not apply SQLite migrations to Supabase.

The dry run against the original database found only four demo users; no live student records need importing. For a different SQLite dataset:

```sh
# Populate .env.production.local first; starts with a read-only dry run.
npm run db:import-sqlite
npm run db:import-sqlite -- --apply
```

The importer refuses a nonempty Postgres target, excludes known demos and non-Georgia Tech accounts, preserves IDs and rental history for eligible users, converts local photos into Supabase Storage, and does not import sessions, magic links, or old email records. The source database is never modified. A failed photo transfer may leave unreferenced objects in the private bucket; rerun only after resolving the error and checking the empty database target.

Local development uses `STORAGE_DRIVER=local` with `data/uploads`. Production requires `STORAGE_DRIVER=supabase`. Files are served through an authenticated API: listing photos are campus-visible; condition photos are limited to rental participants and administrators; private report photos are limited to the reporter and administrator. Supabase service credentials never enter the client bundle.

## Verification

```sh
npm test                  # Domain, filters/order, quote, dates, state rules
npm run test:integration  # App and local Postgres must be running
npm run build             # Compiles the deployable Next.js app
npm run verify:hosted      # After configuring and deploying the hosted environment
```

Local integration tests create disposable accounts/records and remove them afterward. They refuse remote hosts and enabled real email delivery. They cover one-time magic links, stale-campus sessions, auto-active listings, upload validation/privacy, duplicate booking races, reminder races, pickup/return, cancellation, expiration, rating updates, private reports, admin access, rate limits, and CSRF checks.

The hosted smoke test verifies real Postgres and Storage access through Vercel, then cleans up its temporary records. It does **not** replace real inbox verification or the two-student rental walkthrough in the deployment runbook.

`npm run db:seed` is optional and restricted to local databases. It creates illustrated demo records, which are excluded from the launch feed and cannot receive real requests. Never seed Supabase production. `npm run db:studio` opens the configured database inspector.

## Email and jobs

Use domain-authenticated Resend; see [Resend operations](deploy/RESEND.md). Gmail SMTP remains an emergency rollback provider. All sending goes through one provider function with plaintext and HTML alternatives. Verify actual Outlook placement after deployment; SMTP acceptance does not prove inbox delivery.

The job endpoint is `POST /api/jobs`, protected by `Authorization: Bearer <CRON_SECRET>`. Run every 15 minutes using [the Supabase Cron template](deploy/supabase-cron.sql). Pending-request expiration also runs during authenticated browsing. Notifications and reminders are atomically queued. Explicit temporary SMTP rejections are retried automatically (up to five attempts within 23 hours). Concurrent jobs cannot send the same claimed message. Ambiguous network outcomes are marked **Unknown** for manual checking in the Gmail sender mailbox; they are never blindly resent. API acceptance is not confirmation of inbox delivery. The admin email table includes delivery status. Expired sessions/tokens and old sign-in email records are cleaned up by the job.

## Files

- `app/page.js`: landing, browse, accounts, requests, and admin UI.
- `components/forms.js`: listing, profile, and date/price forms.
- `components/ui.js`: accessible modal, fields, upload progress/resizing.
- `app/api/[...path]/route.js`: authentication, authorization, and rental API.
- `lib/campus.mjs`, `lib/browse.mjs`, `lib/rules.mjs`: shared/tested domain and product rules.
- `lib/storage.mjs`, `lib/uploads.js`: private storage and image processing.
- `lib/jobs.js`, `lib/email.js`: scheduled lifecycle work and email.
- `deploy/README.md`: Vercel/Supabase setup and launch verification.

## Signing in

With `REQUIRE_EMAIL_VERIFICATION=true` and `ENFORCE_VERIFIED_ACCOUNTS=true`, new students verify their GT email, create and confirm a password, accept the legal acknowledgment, then provide name and phone. Payment information is optional. Ordinary later sign-in uses email and password; Forgot password uses a fresh email code. The exact admin exception is `jointoga@gmail.com`.

`emailVerifiedAt` is written only after successful ownership proof. Existing accounts retain their IDs, passwords, profile and marketplace history. Unverified accounts verify first; passwordless accounts then set a password. Deployment does not revoke existing sessions. A password reset/setup revokes older sessions. There is no email-only account takeover path. Legacy accounts are not bulk-marked verified from incomplete historical evidence.

Authentication is custom Next.js/Prisma code, not Supabase Auth. Sessions use random 256-bit tokens, hashed server-side, with HttpOnly/SameSite=Lax/Secure production cookies. Cookies and database sessions last 30 days and renew at most daily on activity. Logging out, deleting cookies, private browsing, switching browsers, or 30 days of inactivity requires another login. Password-reset authority expires separately after 15 minutes and is never extended by session renewal.

OTP digests use HMAC-SHA256 with the existing `CRON_SECRET` and a separate purpose prefix, bound to email and challenge. Keep the existing random secret stable and at least 32 characters. Rotating it invalidates outstanding codes. Codes and authentication email bodies are not stored in email history or logged. Development-only `previewCode` responses require non-production mode plus `DEV_EMAIL_PREVIEW=true`; production must keep it false.

### Email delivery and diagnosis

Resend sends from `Toga <login@jointoga.com>` for authentication and `Toga <notifications@jointoga.com>` for notifications. Reply-To is `jointoga@gmail.com`. Both plain-text and minimal HTML parts are sent without tracking. Rental emails use a plain canonical Rentals link. Provider acceptance is distinct from delivery; signed webhooks update delivery/bounce/complaint/failure status. Inbox placement still requires recipient confirmation. See [Resend operations](deploy/RESEND.md).

Vercel logs under `service=toga-auth` distinguish verification request/success/failure/expiry, rate limits, provider request/acceptance/rejection, and ambiguous connection failures. Provider logs include message IDs, HTTP status and request duration, never email addresses, codes, tokens or body text. Authentication emails send immediately and are excluded from the 15-minute rental-job retry queue; ambiguous sends are not automatically duplicated.

### Migration and verification

Migration `20261014000000_email_otp` adds `EmailOtp` and `Session.passwordSetupUntil`, backfilling existing recovery-session expiry. It preserves users, passwords, sessions and rental data. Apply with `node --env-file=.env.production.local node_modules/prisma/build/index.js migrate deploy` before deploying the new app.

Local checks: `npm test`, `node --env-file=.env tests/otp-integration.mjs`, `node --env-file=.env tests/password-integration.mjs`, and the existing rental integration suite. The OTP integration scripts default to port 3003, with real email disabled. Next.js production build performs the configured validity checks; run `npm run lint` separately; this JavaScript repository has no separate TypeScript check.

Optional email-code/recovery checks (`REQUIRE_EMAIL_VERIFICATION=true` for new-account code signup):
1. Open the canonical production URL in a normal browser and choose Sign up / log in.
2. Enter a controlled `@gatech.edu` address and choose Send code. Confirm the code screen opens and resend is disabled for 60 seconds.
3. Find the email (including Junk/Spam). Paste all six digits or type them individually; press Enter. No email link or browser switch is needed.
4. Refresh, open another tab, then close/reopen the browser. The account should remain signed in without another email.
5. Log out and repeat. Verify a wrong code fails, an expired code fails after 10 minutes, and a resent code invalidates the previous code. Five incorrect attempts require a new code.
6. Check existing password login, admin exception, and a rental walkthrough. Never use unrelated students' addresses for tests.


## Profile completion and flexible sizes (October 18, 2026)

After authentication and the existing legal acknowledgement, new and incomplete accounts go to `/complete-profile`. Only name and phone are required. Existing complete profiles bypass it; sessions remain valid. US numbers are normalized to E.164 when saved and displayed in familiar formatting. Explicit international country codes are also accepted. Minimal profile saves preserve omitted optional fields. Phone visibility remains limited to confirmed rental partners. Listing creation and rental requests enforce profile completeness on the server.

Listings use the existing `size` text column. Standard (XXS–XXL and One size), Pants (waist/inseam in inches), Numeric, Shoes, and Custom show only relevant inputs. Pants display as `W32 × L30`; old text sizes are preserved. Size controls are independent of category tags. Browse keeps its simple standard-size filter. No schema migration or bulk profile/size rewrite is required.

Run `tests/onboarding-sizing-integration.mjs` alongside the six existing local integration suites, with `TEST_URL` and `APP_URL` matching the local server. It exercises OTP onboarding, existing-session redirects, required fields, optional-field preservation, API enforcement, and size creation/editing.

The earlier no-domain Resend blocker is resolved by authenticated `jointoga.com`. Gmail code and historical bounce records remain for rollback; only the active provider sends new mail. See [Resend operations](deploy/RESEND.md).


Custom category text is stored in nullable `Listing.customCategory` alongside the existing `Custom` marker in `categories`. Migration `20261019000000_custom_category` only adds that nullable text column; it rewrites no records. Selecting Custom requires 1–40 trimmed characters; deselecting it clears the value. Existing marker-only listings remain readable. Display uses the custom text, while Browse retains only its fixed standard filters. Custom sizing continues to use `Listing.size` without new metadata.

All six Admin queries use creation time descending, then ID descending. Email queue time is `Email.createdAt`; existing email deduplication and query limits remain. Users, listings, requests, and reports now expose small recency timestamps. `tests/admin-recency-integration.mjs` verifies actual API query ordering with deliberately reverse-inserted fixtures; run it alongside the seven existing integration suites.

## Temporary password pilot validation

Run the nine existing integration suites with `REQUIRE_EMAIL_VERIFICATION=true`, then restart the local email-disabled server with `REQUIRE_EMAIL_VERIFICATION=false` and run `tests/pilot-auth-integration.mjs`. Unit tests mock Gmail outcomes; automated tests must never load live Gmail credentials. The pilot suite covers domain/duplicate validation, password hashing, no signup verification message, legal/profile gates, optional payment, explicit-login monitoring, no refresh/session-check monitoring, legacy first-password setup, recovery restrictions, and notification priority under an admin backlog.

Signup and explicit login each schedule one logical admin monitoring message after the successful response using Next.js `after`. Signup uses a deterministic user-based ID; login uses a unique event ID unrelated to session credentials. Refresh and session renewal emit none. Existing marketplace admin IDs remain deterministic per event/rental or report. User SMTP delivery runs after the core response and before its admin copy. The bounded retry queue processes user notifications, reminders, admin marketplace copies, then auth monitoring; Gmail failures never roll back a committed action. Bounces and Unknown/Failed diagnostics remain available in Admin. Admin rental rows expose existing participant name/email/phone and lender payment instructions only to administrators.
