# Limited Georgia Tech pilot release

Continues `review/halloween-legal` from `d79131f`. Production rollout and live verification results are recorded below after execution.

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

Pending migrations reviewed: `20261015010000_legal_acceptance`, `20261015011000_rental_replacement_snapshot`, `20261015012000_nullable_replacement_value`. No reset, destructive development migration, or historical zero conversion is authorized or used.

## Verification distinctions

Local: lint, 23 unit tests, all five integration suites, Prisma validation/generation, and production build. Existing users are permitted to have null new fields and are prompted for current pilot acknowledgment. Active authentication is Gmail email OTP plus existing passwords and legacy magic-link compatibility. SMS is not active.

Mailbox verification is unavailable per the user. Real SMTP acceptance must never be reported as confirmed receipt or Inbox placement. Any seeded-session tests verify application/session behavior, not possession of a real mailbox or completion of the email-code round trip.

Legal issues remain separate: operator identification, jurisdiction, attorney review of liability/indemnity/privacy and retention, and formal copyright-agent procedures if seeking applicable protections. No readiness verdict implies these have been resolved.
