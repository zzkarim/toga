# jointoga.com production operations

Use the `production` checkout in `artifacts/production-release`, not the abandoned root SMS checkout. Existing Vercel project: `toga9/toga`. Do not reset production or seed demo data.

## Configuration

- `APP_URL=https://jointoga.com`
- `EMAIL_PROVIDER=resend`
- `EMAIL_FROM=notifications@jointoga.com`
- `RESEND_API_KEY`: private sending-only key restricted to jointoga.com
- `RESEND_WEBHOOK_SECRET`: private endpoint signing secret
- `REQUIRE_EMAIL_VERIFICATION=true`
- `ENFORCE_VERIFIED_ACCOUNTS=true`
- `ADMIN_EMAIL=jointoga@gmail.com`, `DEV_EMAIL_PREVIEW=false`

Auth sender is `Toga <login@jointoga.com>`; transactional sender is `Toga <notifications@jointoga.com>`. Reply-To is jointoga@gmail.com. No paid mailbox is needed. Keep click/open tracking disabled. Both text and escaped minimal HTML are supplied through the existing outbox/provider boundary.

Webhook: `POST https://jointoga.com/api/webhooks/resend`, events `email.delivered`, `email.bounced`, `email.complained`, `email.failed`, `email.suppressed`. Svix validates raw body, signature and timestamp. Event IDs are unique; events arriving before the outbox provider ID are reconciled after send. A late delivered event never erases a bounce/complaint. Failures appear in Admin and never recursively generate emails.

Queued records retain their provider; switching providers does not resend historical mail through the other provider. Authentication mail is immediate, never queued for delayed retry. Non-auth explicit provider rejections are bounded by the existing outbox retry policy; unknown outcomes require investigation. Accepted means provider acceptance, Delivered means recipient-server delivery, and neither proves Inbox placement.

## DNS and sessions

IONOS remains registrar/DNS. Apex A 76.76.21.21 is valid for the existing Vercel project; www CNAME is d313d06292e144ba.vercel-dns-017.com. Resend DKIM uses the exact dashboard TXT at resend._domainkey. Return-path send has MX feedback-smtp.us-east-1.amazonses.com priority 10 and TXT `v=spf1 include:amazonses.com ~all`. Preserve unrelated IONOS mail records. Existing _dmarc CNAME resolves to `v=DMARC1; p=none;`: monitoring rather than rejecting during rollout.

www redirects to apex. The old toga-ecru.vercel.app host remains available with its existing host-only sessions. Cookies cannot transfer between unrelated domains, so new-domain sign-in is required. The old hostname is narrowly allowed for same-origin API writes while APP_URL is jointoga.com. No broad cross-origin allowance.

## Identity migration

Migration 20261019163000_verified_email_resend is additive: nullable emailVerifiedAt, provider/status metadata, and delivery-event table. No identity backfill or account merge. A verified OTP updates the existing exact normalized email record; existing passwords remain unchanged. Passwordless accounts must prove email ownership before setting a password. An existing password-based admin session remains a fallback. 30-day sessions roll on activity; password-reset authority lasts only 15 minutes.

New signup: GT email → code → password and confirmation → legal acknowledgment → name/phone → marketplace. Returning login: email/password. Recovery: code → new password. Verification must be enabled only after a real authorized GT recipient confirms receipt.

## Rollback

Keep Gmail credentials private in Vercel. To switch sending back, set `EMAIL_PROVIDER=gmail` and `EMAIL_FROM=jointoga@gmail.com`, retain GMAIL_USER/GMAIL_APP_PASSWORD, and redeploy. Gmail deliverability is historically unreliable; never assume it resolves an outage. Do not remove Resend status history or reverse the additive migration.

If an operator decides an email outage requires the temporary password-only signup mode, set both `REQUIRE_EMAIL_VERIFICATION=false` and `ENFORCE_VERIFIED_ACCOUNTS=false`, then redeploy. This explicitly pauses ownership enforcement; it must never happen automatically. Existing verified state/passwords remain. Keep APP_URL=https://jointoga.com unless the domain itself is unavailable. Preserve current secrets and backup before any rollback. Restoring old code does not require a database reset.

## Validation

Run unit tests, lint, Prisma validate/generate and production build. Run the nine existing integrations with verification true and account enforcement false; pilot-auth-integration with both false; verified-migration-integration with both true and a disposable local Svix secret. Real email keys must not be loaded in automated integration tests. The latter suite checks new signup, existing identities/passwords, reset, 30-day cookies and signed webhook replay/bounce precedence.

Live receipt, Inbox/Junk placement, existing-account migration, and the full new-student browser flow require authorized mailboxes. Do not delete a real account to manufacture a new-user test. Do not call the release fully ready when the required live flow remains untested.
