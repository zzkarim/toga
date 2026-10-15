# Limited Georgia Tech pilot release

Continues `review/halloween-legal` from `d79131f`. Deployed through the linked Vercel CLI on the `production` branch. No Git remote is configured, so a push was not possible. The canonical URL is https://toga-ecru.vercel.app/. `/api/health` reports the exact deployed commit and `halloween` theme.

## Release changes

- Publish clearly marked **non-final pilot** Terms/Privacy/Safety documents. Missing operator identity and jurisdiction produce truthful explanatory sentences, not raw placeholders. No entity, lawyer approval, or registration is invented.
- Remove the build/runtime hard block on incomplete legal facts while preserving server-enforced adult/pilot acknowledgment, versions/timestamps, lender confirmation, renter responsibility and replacement-value snapshots. Document versions: `2026-10-15-pilot-v3`.
- Add database-backed per-user limits: 20 listing creations/hour, 20 rental requests/hour, 10 reports/hour. Existing authentication/verification/upload limits remain.
- Add authenticated GET support for maintenance and a daily Vercel cron (`0 12 * * *`, UTC). Existing POST/manual runner remains. Vercel supplies `CRON_SECRET` as a bearer token; unauthenticated access is rejected. Scheduling follows [Vercel cron documentation](https://vercel.com/docs/cron-jobs/manage-cron-jobs). Daily scheduling is not an exact reminder-time guarantee.
- Public health response exposes only status, theme, and `TOGA_RELEASE_SHA` to verify the deployed code/configuration.

## Configuration

Required names: `DATABASE_URL`, `DIRECT_URL`, `APP_URL`, `ADMIN_EMAIL`, `EMAIL_PROVIDER`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `EMAIL_FROM`, `DEV_EMAIL_PREVIEW`, `CRON_SECRET`, `STORAGE_DRIVER`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`, `TOGA_THEME`. `TOGA_RELEASE_SHA` records the deployed commit.

`SENDGRID_API_KEY` is obsolete in this release; it remains stored remotely for rollback of older releases but is not read by current application code. SMS/Twilio variables and local upload/database/development preview settings are not part of this release. Production Gmail/Supabase secrets are encrypted and cannot be pulled as plaintext through Vercel CLI. Names were inspected; local private configuration validates; remote build and live checks verify effective configuration without printing values.

`LEGAL_OPERATOR_NAME`, `LEGAL_GOVERNING_JURISDICTION`, and `LEGAL_REVIEW_APPROVED` remain unset and unresolved. They are not software launch gates for this explicitly authorized pilot. `LEGAL_DRAFT_PREVIEW` is no longer used. `TOGA_THEME=classic` plus redeployment switches off Halloween markup and restores classic colors without a code rollback.

## Database protection

A permission-restricted, compressed logical snapshot of every table in the `toga` schema was taken in a repeatable-read transaction before migration, under ignored `.data/backups/`. It includes original rows, column definitions and migration history. This is an app-schema recovery snapshot, not a provider-wide backup of storage objects or all database roles. The migrations only add nullable fields and relax one NOT NULL constraint; they do not modify existing values or storage objects.

Applied production migrations: `20261015010000_legal_acceptance`, `20261015011000_rental_replacement_snapshot`, `20261015012000_nullable_replacement_value`. No reset, destructive development migration, or historical zero conversion is authorized or used.

## Verification distinctions

Local: lint, 23 unit tests, all five integration suites, Prisma validation/generation, and production build. Existing users are permitted to have null new fields and are prompted for current pilot acknowledgment. Active authentication is Gmail email OTP plus existing passwords and legacy magic-link compatibility. SMS is not active.

Mailbox verification is unavailable per the user. Real SMTP acceptance must never be reported as confirmed receipt or Inbox placement. Any seeded-session tests verify application/session behavior, not possession of a real mailbox or completion of the email-code round trip.

Legal issues remain separate: operator identification, jurisdiction, attorney review of liability/indemnity/privacy and retention, and formal copyright-agent procedures if seeking applicable protections. No readiness verdict implies these have been resolved.

## Production verification results — 2026-10-14

**Verified**

- Production configuration validation, schema validation/generation, production build, ESLint, all 23 unit tests and all five local integration suites passed after the mobile fix. No separate TypeScript check exists.
- Original 2 users, 1 listing, 7 rentals, 4 uploads, 2 condition checks and all original field values (including payment information) were preserved. Original ratings/reports were empty. Disposable production users, rentals, ratings, reports, test image/storage object and marker notification records were removed after testing.
- Live API tests covered hosted image upload and private access, invalid upload errors, listing create/edit/browse, missing versus explicit zero replacement values, account save/reload, request/accept/decline/pickup/return/completion, ratings and reports, all admin datasets, and private contact/payment release only to authorized partners in the appropriate rental state.
- Live permissions rejected unrelated listing edits, rental transitions, ratings and admin access; anonymous protected endpoints and unauthenticated jobs were rejected. Invalid domains/dates and unavailable/missing listings returned controlled errors. Actual production OTP bodies were redacted in email history. Known private production secrets were absent from tracked source and fetched live JS/CSS assets.
- Browser checks covered login/OTP layout and resend/change-email controls, invalid domain feedback, browse/search/category/size/price filters and empty states, detail/creation/rating/report dialogs, own listings, both rental directions, account payment save and refresh, all admin sections, unread badge/banner and mark-read. A 320px header overflow was found and fixed. Tested 320/375/390/430px widths without document overflow on browse, creation, rating/report dialogs and admin tables; OTP boxes also fit all widths. Buttons showed loading/disabled feedback during auth and saves.
- Browser refresh preserved a disposable authenticated session. Logout worked. Local integration tests verified 30-day creation, renewal, expiry and logout. Existing production session remained recognized after migration and the user reported accepting the new pilot acknowledgment.
- Halloween theme and decorations were visually present on the live site. Decorative layers were aria-hidden and pointer-events:none. User clothing photos had no CSS filter. No captured browser warnings/errors; production logs had no unexpected errors during checked windows. Fetched live assets returned 200; about 563 KB total uncompressed across the nine inspected JS/CSS assets.
- Gmail SMTP accepted new-request, acceptance, decline and four pickup/return reminder emails. Authenticated live maintenance job succeeded; anonymous access failed. In-app notifications were verified independently of email.

**Code-reviewed / limited execution**

- Active authentication is Gmail email OTP, existing-password login and legacy magic-link compatibility. Seeded disposable sessions/magic links enabled live transactional checks; they do not prove receipt of a real OTP. Password recovery and OTP expiry/reuse/attempt limits were executed locally, not through a real production mailbox.
- Reduced-motion CSS disables seasonal animations and transitions; no OS/browser reduced-motion emulation was available in the exposed testing capability. Keyboard labels/focus/modal semantics and escaped React text were inspected; this is not a formal accessibility or penetration audit.
- `TOGA_THEME=classic` switches the server-rendered body class and disables seasonal decoration rendering; redeploy after changing it. Production finishes in Halloween mode. No production classic-mode flip was performed.
- Daily cron setup is deployed; its authenticated endpoint was run manually. A future scheduled execution has not yet been observed. Daily timing cannot guarantee an exact reminder delivery time.

**Blocked**

- The user explicitly said mailbox verification is unavailable. Real OTP receipt-to-code-entry and notification Inbox/Junk placement at Georgia Tech cannot be confirmed. SMTP acceptance is not delivery verification. SMS is not active and no SMS delivery is claimed.
- Full browser close/reopen after a real email-code login remains unverified; refresh continuity and persistent-session configuration/tests passed.

## Remaining work and verdict

Before inviting the waitlist, perform one real Georgia Tech OTP login, close/reopen the site, and confirm receipt/placement of rental notifications in the target mailbox. There is no known remaining failure in the exercised marketplace workflows, but the external authentication/delivery round trip is required by this release standard.

Unresolved legal items: operator legal identity, governing jurisdiction, final attorney review and any formal copyright-agent process. Documents explicitly remain non-final drafts; these are not represented as software defects or as legally approved.

Non-blocking maintenance: Prisma package.json configuration deprecation, Next ESLint-plugin warning, daily cron timing, and absent Git remote. Keep the private pre-migration snapshot outside deployment bundles. No test fixtures remain in the marketplace.

**NOT PRODUCTION READY** — required real-mailbox authentication and delivery verification is unavailable.
