# Authentication, payment and admin follow-up fixes

## Root causes and corrections

- The reported joined actions and old payment label match the older live deployment. The SMS/payment release was implemented locally but was not deployed without Twilio setup. Local OTP buttons relied on inline flow/margins; they now have a flex container with a real gap, wrapping on desktop and stacked touch targets on mobile. Resend alone is disabled during cooldown; changing email/phone is available.
- The current account form already used paymentInfo. Old README wording and the legacy SQLite importer were missed; both are corrected. The importer now converts old handles rather than passing an unknown field to Prisma.
- My Rentals gets partner data from the authorized `/api/requests` response. It incorrectly fell back from verifiedPhone to the legacy unverified phone. The fallback is removed, and phoneVerifiedAt is required. US display formatting is separate from the canonical E.164 value. The name appears beside the phone. Lender payment text has its own section, so it still displays even if that lender must reverify their contact number.
- High-Value was a client-side filter of the admin listing data. Its tab/filter branches and the now-unused automatic flag calculation were removed. Existing listings and stored highValue values are untouched. The historical schema flag and import conversion remain inert compatibility metadata, not an admin feature.
- Email records previously had no category; `/api/admin` fetched the newest fifty individual records. The backend now deduplicates authentication by normalized recipient, preserving every transactional event, then sorts/limits the combined results.

## Important changed files

| File | Change |
| --- | --- |
| `components/auth-form.js`, `app/globals.css` | Dedicated responsive verification action layout; independent cooldown states |
| `components/forms.js` | Account contact field shows only the verified phone (or Not verified); flexible Payment information remains canonical |
| `app/page.js` | Named/formatted rental contacts, separate payment section, removal of High-Value admin UI/filter |
| `lib/contact.mjs` | US display formatting without changing stored phone values |
| `app/api/[...path]/route.js` | Verified contact-only participant payloads, typed/deduplicated admin email query, removal of unused high-value calculation |
| `lib/admin-emails.js` | SQL authentication-only deduplication before the fifty-row display limit |
| `lib/email.js` | Explicit message category required by the sender; authentication bodies redacted by category |
| `lib/jobs.js` | Retains authentication metadata while redacting credential bodies by category instead of deleting logs by subject |
| `prisma/schema.prisma` | EmailCategory enum, Email.category and category/recipient/date index |
| `prisma/migrations/20261014020000_email_categories/migration.sql` | Additive category migration; one-time classification of historical code/link templates; no records deleted |
| `scripts/import-sqlite.mjs` | Maps legacy handles to paymentInfo before import; removes legacy input key |
| `tests/integration.mjs` | Save/reload payment, verified-vs-legacy phone source, missing verification timestamp, participant-only access |
| `tests/admin-email-integration.mjs` | More than fifty duplicate auth records, normalized recipients, deterministic ties, transactional preservation, safe response fields |
| `tests/email-category-migration.mjs`, `tests/contact.test.mjs` | Migration backfill and display-format regression checks |
| `README.md`, `deploy/SMS.md`, `deploy/UI-FIXES.md` | Terminology, release/retirement notes and handoff |

## Data and privacy

`paymentInfo` is the only active payment field. The prior SMS migration copies old handles as `Venmo: @handle`; that migration remains pending in production until SMS rollout. The SQLite source schema and historical migration SQL intentionally keep old field names. The physical Postgres legacy column is retained temporarily for rollback, not exposed by the new Prisma model or UI. After successful rollout and the rollback window: back up, reconcile any late legacy writes, verify old values are represented in paymentInfo, and create a reviewed migration dropping only the obsolete venmoHandle column. Do not edit already-applied historical migrations or delete user payment data.

Phone/payment fields are absent from listing-owner objects and pending/declined/cancelled rental partner responses. Only requests involving the signed-in user are queried. Confirmed/active/completed participants may see a phone only when verifiedPhone and phoneVerifiedAt both exist. Only the renter sees the lender's paymentInfo. Unrelated IDs do not authorize access. Payment text is rendered as React text, not HTML.

The Email category is explicit AUTHENTICATION or TRANSACTIONAL. The migration uses the two known old subject lines exactly once to backfill historical data. Runtime classification never depends on subject wording. SQL DISTINCT ON lower(trim(recipient)) selects the newest authentication record using createdAt descending then id descending. UNION ALL keeps individual transactional events. Sorting and LIMIT 50 occur after deduplication. Raw bodies are not sent to the admin table. New authentication traffic is SMS and is not added to the historical Emails table.

## Production steps

No new environment variables are introduced by these fixes. The four Twilio variables and sender/service setup from `deploy/SMS.md` are still required for the pending SMS release.

1. Finish Twilio setup and preserve the admin's existing session/password for phone enrollment. Do not deploy an unconfigured SMS login.
2. Back up production, check `prisma migrate status`, and run `node --env-file=.env.production.local node_modules/prisma/build/index.js migrate deploy`. This applies both pending SMS/payment and email-category migrations if neither has run.
3. Run `npm run check:production`, then `vercel deploy --prod --scope toga9`.
4. Repeat the real-device SMS tests in `deploy/SMS.md`. Confirm profile Payment information, accepted-rental named contact/payment, absent High-Value tab, and one authentication row per recipient in Emails. Keep transactional rows separate. Test with a third account and a pending request to verify privacy.

The migrations were tested/applied locally only. Production has not been changed by these fixes. Real SMS delivery still requires configured Twilio services and a handset test.

If the old email-login deployment remains writable between migration and cutover, classify any last legacy authentication messages once after the new deployment is live (SQL editor or migration operator):

```sql
UPDATE "toga"."Email" SET "category" = 'AUTHENTICATION'
WHERE "category" = 'TRANSACTIONAL'
  AND "subject" IN ('Your Toga verification code', 'Your Toga sign-in link');
```

This is a one-time legacy catch-up, not the runtime classification rule. Current email sends require an explicit category; SMS login creates no email records.

Verified locally: 20 unit tests, SMS authentication integration, full rental lifecycle/privacy integration, authentication-email query integration, and a rolled-back migration test against historical email templates. Browser checks at desktop and 390px mobile confirmed independent cooldown controls, successful resend, account payment save/reload, accepted-rental verified contact/payment rendering, removal of the High-Value tab, and latest-auth-only admin display with separate rental events. Browser console checks found no errors. Disposable UI fixtures were removed.

## Live login hotfix — October 14, 2026

Production deployment `dpl_6yBA5ppUxNKhEVLeUH2Ah7M1PsTr` is live at https://toga-ecru.vercel.app.
The prior production source was recovered into `/tmp/toga-live-hotfix` and only its login action layout, code input borders, and public domain wording were changed. Production build passed. This preserves the working email authentication backend while Twilio provisioning is blocked. No database migration was run for this hotfix. The workspace SMS implementation is still pending deployment; do not mistake this release for an SMS rollout.

The live Twilio console explicitly requires an account upgrade to create **both** a Verify service and a Messaging Service. There are therefore no production SMS delivery results to certify yet. Account upgrade/payment must be completed by the owner, followed by provider setup, production environment configuration, pending migrations, SMS deployment and real consented delivery tests.

The exact hotfix source is archived at `artifacts/live-login-hotfix-source.tar.gz` (no secrets). Workspace unit suite: 20 passed.

## Payment release audit — October 14, 2026

The Vercel project API reports `link: null`: no GitHub repository or deployment branch is connected. The prior live deployment `dpl_6yBA5ppUxNKhEVLeUH2Ah7M1PsTr` reports `source: cli`, `gitSource: null`, with no Git commit metadata. The workspace has no `.git` directory. Consequently there is no local/GitHub/production commit chain to compare. The prior isolated login hotfix deliberately retained the old `ProfileForm` in `components/forms.js`, which rendered `Venmo handle`, submitted `venmoHandle`, and used the old Prisma model. The live database contained only `venmoHandle`. Local payment/SMS changes were not part of that deployment. Neither duplicate profile components nor cache was the cause.

The new isolated release in `/private/tmp/toga-live-hotfix` ports the payment field independently, leaving working email-code/password authentication intact. It updates the exact ProfileForm, API validation/save/read path, accepted-rental partner projection/display, Prisma field and legacy importer. Payment instructions are restricted to the lender's accepted renter in rental responses. The new PATCH path preserves omitted payment information and rejects stale legacy-profile payloads instead of wiping or silently losing their changes.

Applied existing additive migration `20261014010000_sms_and_payment` to Supabase. It retains the legacy column and creates the new field plus previously prepared inactive SMS schema. SMS is not enabled by that migration. Verification immediately after migration: 2 users retained; 1 nonempty legacy value retained; 1 correctly migrated payment value. No user/payment rows deleted. Email-category migration remains pending and is not needed by this release.

There are no TypeScript source files or tsconfig in this JavaScript app; standalone TypeScript checking is not applicable. Added ESLint correctness checks to the isolated release and ran Prisma validation, payment migration preservation test, payment unit checks, and production build. The workspace's 20 existing unit tests passed. Exact final deployment/build/API/UI results are recorded below after verification.
