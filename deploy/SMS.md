> Production status: SMS remains unreleased. The current release uses Gmail SMTP email codes, passwords, and rental emails. This document describes preserved SMS implementation work, not the active production authentication system.

> Current decision (October 14, 2026): no paid Twilio upgrade and no replacement SMS provider enabled. See the free-provider assessment below. The Twilio instructions are retained as historical implementation documentation.

# Toga SMS rollout and testing

## Release status

Implemented locally. The new migration has been applied to the development database only. The production site and database have NOT been switched to SMS: Twilio credentials and an approved transactional messaging sender are still required. Do not deploy until the setup below is complete. Do not clear production data.

## Architecture and security tradeoff

Toga uses its own Next.js/Prisma authentication, not Supabase Auth. Previously it sent email OTPs through SendGrid and supported passwords and legacy magic links. Rental notifications used a transactional Email outbox. Users already had an unverified `phone` and optional `venmoHandle`.

SMS now uses Twilio Verify, which manages six-digit codes and their 10-minute lifetime. No SMS code is stored by Toga. A server-side challenge binds the provider verification to the email, phone and (for enrollment) existing account session. Code checks are serialized and consumed once. The same Twilio code may be resent during its validity period; only the latest Toga challenge can submit it. Resend does not reset the five-attempt limit or extend the challenge lifetime.

An allowed email suffix is NOT proof of Georgia Tech identity. A new user can enter an unclaimed Georgia Tech address they do not own. `emailVerifiedAt` remains null; `phoneVerifiedAt` is separate so future campus SSO/email proof can be added honestly. SMS is vulnerable to SIM swaps and number reassignment. Never recover an existing account just because someone supplies its email and a new phone.

Persistent sessions retain random server-side credentials and HttpOnly, Secure (production), SameSite=Lax cookies. Sessions last 30 days and renew on activity at most daily; logout revokes them. Browser cookie deletion/private browsing or more than 30 days inactivity still requires login. Password-reset privilege expires separately after 15 minutes.

US phone numbers only for this pilot, parsed with libphonenumber-js and stored in E.164. A successful OTP proves reachability; landlines that cannot receive texts cannot complete signup. Phone and payment data remain private in the server database (use Supabase TLS, restricted credentials and encryption at rest); the app does not add field-level encryption. Listing/user cards expose only public identity fields. Confirmed rental partners retain existing phone-sharing behavior. Only the renter receives the lender's payment instructions after acceptance, including after completion. Unrelated users cannot retrieve the rental.

## Twilio setup (manual)

1. Create or sign in to your Twilio account. Upgrade/fund it for live students; a trial account can restrict recipients and is not a production test. Set usage alerts and enable available fraud protections. Do not paste credentials into chat.
2. In **Verify → Services**, create a service named **Toga**, enable SMS, and set code length to **6**. Keep the default 10-minute lifetime. Enable Fraud Guard and restrict geographic permissions to the United States. Copy its `VA…` Service SID. Verify handles the authentication sender separately from rental messages.
3. In **Messaging → Services**, create a service for Toga transactional rental updates. Add an SMS-capable sender. Complete the applicable sender registration/approval: US local-number A2P 10DLC brand/campaign registration, or toll-free verification for a toll-free sender. Follow the account's current Console instructions; Verify setup alone does not authorize this rental-message sender. No email domain purchase is needed, but Twilio SMS and sender registration are not free.
4. Configure **Advanced Opt-Out** for that Messaging Service with STOP, START and HELP. Identify Toga in responses, say how to stop texts, and use `jointoga@gmail.com` for help. STOP should disable rental messages; START should lift the carrier block. In Toga, users then explicitly re-enable their notification preference.
5. Set the Messaging Service's incoming-message integration to POST to `https://toga-ecru.vercel.app/api/sms/webhook`. Ensure the service routes incoming messages to this webhook and sends `OptOutType`. Do not leave incoming messages set to drop. The app validates Twilio's signature and Account SID. No browser CSRF token is needed for this signed provider endpoint.
6. Delivery status callbacks are supplied on each outgoing rental message to the same URL. Optionally configure that URL as the service delivery-status callback too. Use the canonical APP_URL, without redirects or query rewrites; signature validation depends on the exact URL.
7. For sender registration, use the signup/Account checkbox screenshots and the public `/sms` terms/privacy page as evidence of the actual consent flow. The optional rental-notification checkbox starts unchecked. No marketing messages are supported. If Console requests a live consent page before approval, use a separately configured preview deployment; do not replace live login before Verify is usable.

Official references: [Verify setup/API](https://www.twilio.com/docs/verify/api), [code lifetime and resend behavior](https://www.twilio.com/docs/verify/api/rate-limits-and-timeouts), [Messaging Services and Advanced Opt-Out](https://www.twilio.com/docs/messaging/services), [A2P 10DLC registration](https://www.twilio.com/docs/messaging/compliance/a2p-10dlc).

## Environment and Vercel configuration

Add these server-only variables to Vercel project **toga**, Production (and separately Preview if testing there):

- `TWILIO_ACCOUNT_SID`: account SID (`AC…`).
- `TWILIO_AUTH_TOKEN`: that account's auth token, also used to validate signed callbacks.
- `TWILIO_VERIFY_SERVICE_SID`: Verify service SID (`VA…`).
- `TWILIO_MESSAGING_SERVICE_SID`: approved rental Messaging Service SID (`MG…`).

Do not use NEXT_PUBLIC prefixes. No sender phone is hardcoded; the Messaging Service selects its registered sender. Keep existing DATABASE_URL, DIRECT_URL, APP_URL, ADMIN_EMAIL, CRON_SECRET and Supabase storage variables. Keep APP_URL exactly `https://toga-ecru.vercel.app` for production. SendGrid variables are no longer needed for these auth/rental flows; historical Email records are retained and not retried. DEV_EMAIL_PREVIEW must remain false in production; there is no production SMS preview/bypass.

1. Save the four credentials securely in `.env.production.local` for local deployment commands and in Vercel project settings. Never commit that file.
2. Run `npm run check:production`. This intentionally fails if Twilio is missing; it does not test provider credentials or carrier approval.
3. Back up production and check migration status. Apply with `node --env-file=.env.production.local node_modules/prisma/build/index.js migrate deploy`.
4. Deploy `vercel deploy --prod --scope toga9`. Run the hosted checks and the real-device scenarios below. Keep the existing 15-minute `/api/jobs` scheduler; it now processes the SMS outbox and reminders.
5. Inspect Vercel logs (`toga-auth`, `toga-sms`), SmsNotification status/provider IDs and Twilio Messaging/Verify logs. Accepted means provider acceptance, not handset delivery. Check Delivered callbacks on real messages.

## Migration and existing users

`prisma/migrations/20261014010000_sms_and_payment/migration.sql` is additive. It adds nullable verifiedPhone (unique), phoneVerifiedAt, emailVerifiedAt, consent timestamp/version, notification preference and carrier opt-out timestamp. It adds SmsChallenge and SmsNotification with restricted schema permissions. It copies existing `venmoHandle` to `paymentInfo`: `zayan` or `@zayan` becomes `Venmo: @zayan`. The legacy physical column is retained for rollback compatibility but is no longer used by the new Prisma model/UI. It is not synchronized after cutover; do not roll back to old Venmo editing without reconciling new payment data.

Old phones remain intact but are NOT marked verified or opted in. Existing sessions/passwords continue to work. Account shows phone enrollment; new listings and rental requests require a verified phone. Existing rental accept/decline/pickup/return actions remain accessible so onboarding does not strand ongoing rentals. Users with neither a session/password nor verified phone must contact support for identity-checked recovery; there is deliberately no email-claim bypass. The exact admin email exception remains `jointoga@gmail.com` and should be enrolled from the admin's existing session before cutover.

No live records are deleted. Historical email tokens/OTPs cannot log in through the disabled email endpoints. Existing users are not falsely marked email-verified.

## Notification behavior and consent

Outbox events: new request, accepted, declined, cancelled, pickup, return, and both partners' existing pickup/return reminders. Messages avoid names, item descriptions and payment information; they link to the rentals screen. Queueing is atomic with the rental update. Provider delivery occurs afterward and failures do not roll back or turn the successful rental action into an error. Unverified, opted-out or non-consenting recipients are skipped; users can still view all activity inside Toga.

A 429 rejection can be retried by scheduled jobs (maximum five claims, only records younger than 24 hours). Definite other rejections are Failed. Network/timeouts/interrupted sends are Unknown and never automatically resent, avoiding duplicates. Accepted delivery is updated by signed callbacks. Check provider history before manually retrying ambiguous sends. Sender/provider STOP error 21610 also disables the app preference.

Limits: five sends per phone and email per 15 minutes, 60-second cooldown, five code checks per challenge, twenty verification requests per email per 15 minutes, thirty verification sends globally per hour. Rental notifications are limited to thirty per user and three hundred globally per day. New rental requests are limited to twenty per user per hour. These conservative pilot caps can require adjustment before a large waitlist launch. They do not replace Twilio fraud controls and spend monitoring.

## Exact real-device acceptance tests

### New user and sessions

1. Use a real US mobile number you control and a previously unused Georgia Tech email you control. Open a private browser or log out of a dedicated test account.
2. Confirm a non-gatech email is rejected and malformed phone numbers are rejected. The exact admin exception is separately permitted.
3. Enter the Georgia Tech email and phone, check account verification consent, optionally check rental notifications, then Send code. Confirm a text arrives and no auth email is sent.
4. Check six input boxes, auto-advance, full-code paste, Enter submission, loading state and resend cooldown. Try one incorrect code, then the correct code. Confirm Account opens and shows the verified phone.
5. Save a name and payment instructions. Refresh, reopen the tab, and restart a normal browser: login should persist. Explicit logout should require login again.
6. On a separate verification attempt, wait ten minutes and confirm expiration. Try five wrong codes and confirm lockout. Resend after the cooldown and use the newest screen. Verify a submitted code cannot be replayed.
7. From a different browser, attempt an existing email with a different phone: it must not grant access. For a legacy account, sign in with its password and enroll from Account; confirm its original listings/history remain.
8. Ensure normal login does not expose passwordHash, OTPs or provider tokens in API responses/logs.

### Rental SMS

1. Use two controlled accounts with distinct verified phones and explicit rental SMS opt-in. Lender creates a listing with a real photo; renter requests dates.
2. Confirm the lender receives one new-request text. Accept: renter gets an acceptance text. On a separate request, decline and verify the decline text. Cancel another pending request and verify the lender text.
3. Mark picked up and returned from the renter account; confirm lender notifications. Check the rental status updates even if delivery is delayed.
4. For a controlled staging rental within the reminder windows, run `/api/jobs` using the protected scheduler. Confirm one reminder per partner for pickup and return, even if jobs run twice. Never alter unrelated live rentals to test dates.
5. Disable SMS in Account, then trigger another controlled rental event: no notification should be sent, but the event remains visible in My Rentals.
6. Opt back in, reply STOP to the actual rental sender, and verify the preference becomes disabled. A forged webhook must be rejected. Reply START, refresh Account and explicitly opt back in before expecting more notifications. Reply HELP and confirm Twilio's configured help response.
7. Verify a provider rejection/failure does not undo a successful request; inspect SmsNotification status and provider ID. Use staging/mock tests for failure injection rather than damaging production credentials.

### Payment privacy

1. Lender saves `Cash at pickup or PayPal: example@example.com`; reload Account to confirm it persists. More than 500 characters must be rejected server-side.
2. Before acceptance, check listing cards, detail responses and pending request data: no paymentInfo or private phone fields should appear on public owner objects; pending partner data must omit paymentInfo.
3. Accept the request: only its renter sees the lender's full instructions. The lender should not receive the renter's private payment instructions.
4. With a third account, try fetching/interacting with that rental using its ID: no private data or action access. HTML entered in paymentInfo must render as text, never execute.
5. Confirm a migrated existing Venmo value reads `Venmo: @handle`. Test users' data must be cleaned up narrowly; do not wipe the live database.

## Local automated tests

`npm test`, `npx prisma validate`, `npx prisma generate`, `npm run build`; the repository has no separate ESLint/TypeScript configuration. Next's production build runs its configured validity checks. Prettier checks changed source files.

The SMS integration harness intercepts only Twilio requests in a local Next server. It refuses production or a remote database and is excluded from Vercel uploads. It requires TWILIO_AUTH_TOKEN=local-test-token, arbitrary syntactically valid test SIDs, and `NODE_OPTIONS='--import ./tests/mock-twilio.mjs'` when starting Next. Start with APP_URL=http://127.0.0.1:3003 and real email disabled. Run `tests/sms-integration.mjs`, `tests/password-integration.mjs`, and `tests/integration.mjs` against that server. This proves application behavior, not Twilio approval, real SMS delivery, or carrier STOP behavior.

## Important changed files

| Files | Purpose |
| --- | --- |
| `prisma/schema.prisma`, `prisma/migrations/20261014010000_sms_and_payment/migration.sql` | Verified-phone/consent/payment fields, challenge and SMS outbox, non-destructive Venmo copy |
| `lib/phone.mjs` | US/E.164 validation, payment-length/control-character validation, consent version |
| `lib/twilio.mjs` | Verify and Messaging REST requests, timeout handling, safe diagnostics, webhook signature validation |
| `lib/sms-auth.js` | Provider-managed OTP requests/checks, account binding, existing-account protection, cooldowns/limits |
| `lib/sms.js` | Central transactional SMS queue/delivery/retry service and send caps |
| `lib/jobs.js` | SMS reminders/outbox processing; no legacy rental-email retry |
| `app/api/[...path]/route.js` | SMS auth routes, disabled email login, verified-phone gating, payment privacy/validation, rental SMS events, minimal admin user payloads |
| `app/api/sms/webhook/route.js` | Signed STOP/START and delivery-status callbacks |
| `components/auth-form.js` | Phone/consent collection, SMS code-entry UI and legacy password option |
| `components/forms.js` | Verified-phone enrollment, optional rental SMS preference, multiline payment instructions |
| `app/page.js`, `app/globals.css` | Account wiring, accepted-rental payment display, mobile OTP/consent styling |
| `app/sms/page.js` | Public SMS terms, privacy and support information |
| `package.json`, `package-lock.json` | libphonenumber-js dependency |
| `.env.example`, `.env.production.example`, `scripts/check-production.mjs` | Twilio environment conventions and deployment guard |
| `.vercelignore` | Exclude local mock-provider tests and screenshots from deployment |
| `scripts/check-launch-empty.mjs`, `scripts/verify-hosted.mjs` | New storage models and SMS endpoint smoke checks |
| `tests/sms.test.mjs`, `tests/sms-integration.mjs`, `tests/sms-migration.mjs`, `tests/mock-twilio.mjs` | Phone/payment/signature unit tests; isolated provider, auth and legacy-data migration regression tests |
| `tests/password-integration.mjs`, `tests/integration.mjs`, `tests/otp-integration.mjs` | Updated password recovery and rental regressions; old OTP test command redirects to SMS suite |
| `README.md`, `deploy/SMS.md` | Current release status, migration and manual setup/test instructions |

Verification completed locally: 19 unit tests; SMS auth (including expiry, five-attempt lockout, concurrent one-time use, enrollment, STOP/START and session renewal); password lifecycle; rental lifecycle/privacy/reminder concurrency/provider failure; migration backfill/rollback compatibility; Prisma validation/generation; production build. Mobile 390×844 browser checks exercised paste, Enter, refresh persistence and saving payment instructions. No real SMS delivery or live carrier opt-out was claimed.

The follow-up UI/contact/admin corrections and additional email-category migration are documented in [UI-FIXES.md](UI-FIXES.md). This includes the eventual legacy payment-column retirement plan and the requirement to apply all pending migrations before deploying.

## Free-provider assessment — October 14, 2026

Decision: no replacement is enabled. None of the researched services establishes a reliable, compliant, hardware-free, permanent zero-cost SMS channel for this US student launch. Production still uses the working email-code/password flow; that flow has not been replaced or silently reverted. The workspace Twilio implementation remains undeployed.

| Option | Real US SMS / codes / rental notices | Free allowance and card | Hardware and Vercel | Registration, domain and compliance |
| --- | --- | --- | --- | --- |
| TextBee | Yes with a SIM that can reach US numbers; codes and transactional text can be sent, but Toga must implement secure OTP verification | Permanent $0 software tier, no card; 50/day, 300/month, sent **and received** count; carrier charges excluded | One Android 7+ device with active SIM, power, internet and background permissions; Vercel can call HTTPS API, but phone/carrier availability controls delivery | Hosted setup does not list business registration or custom domain requirements. This is NOT carrier permission. Terms require carrier compliance, consent and app-managed STOP; no verified compatible Toga SIM/plan is available |
| SMSGate | Android SMS supports authentication and transactional messages to destinations allowed by SIM | Free open-source/local and current cloud service; no published fixed monthly cloud cap, fair-use limits possible; no software card required, SIM costs remain | Android 5+, SIM and always-on device; cloud HTTPS API usable by Vercel; local LAN mode cannot be reached directly by Vercel | No app registration/custom domain required; actual carrier terms still apply. Cannot certify US automated production use without the specific plan's approval |
| Textbelt | Real US SMS, verification API and ordinary transactional SMS | Public test key offers 1 free text/day (28–31/month); no card for that test. More traffic requires purchased credits | No phone hardware; HTTP API works from Vercel; shared one-per-day test allowance cannot support a waitlist | Sender identity, consent and opt-out rules apply. No custom domain is stated for API testing. Production onboarding/registration requirements must be confirmed with provider; not assumed waived |
| Infobip | US SMS and verification/transactional products available, subject to sender onboarding | Temporary 60-day trial, up to 100 messages/channel (varies); only one verified phone recipient. No permanent free production allowance. Trial card requirement not established by inspected docs; production requires funding | Hosted API works from Vercel; no hardware | Trial test sender only; real US sender approval/registration required as applicable. No purchased domain requirement established for SMS itself; exact onboarding must be confirmed |
| Firebase phone authentication | Verification only; not a general rental notification SMS service | SMS requires billed Blaze plan; no free Spark SMS. No permanent free monthly SMS allowance established | Hosted, no Android gateway hardware; would add another auth system | Billing account required. Does not solve both requested message types; no custom purchased domain needed merely to use Firebase's hosted auth domain |
| Supabase + Vercel (existing) | Neither provides an included free carrier SMS transport | No included monthly SMS allowance; Supabase phone login requires a third-party provider | Already hosted, but still needs external delivery infrastructure | Existing infrastructure does not waive sender/carrier requirements |

Sources checked directly:
- [TextBee pricing](https://textbee.dev/pricing), [FAQ](https://textbee.dev/docs/faq), [terms](https://textbee.dev/terms-of-service).
- [TextBee send API](https://textbee.dev/docs/sending-sms/sending-sms): `POST https://api.textbee.dev/api/v1/gateway/send-sms`, server-only `x-api-key`, JSON `recipients` (E.164), `message`, optional `deviceId`. A successful response queues a batch; it does **not** prove delivery. TextBee supplies transport, not secure OTP verification. Possible future configuration: `TEXTBEE_API_KEY`, `TEXTBEE_DEVICE_ID`, and authenticated inbound webhook handling. These are **not implemented or required by the deployed app**.
- [SMSGate pricing](https://docs.sms-gate.app/pricing/), [product and hardware requirements](https://sms-gate.app/).
- [Textbelt free test](https://textbelt.com/), [compliance](https://docs.textbelt.com/compliance).
- [Infobip trial restrictions](https://www.infobip.com/docs/essentials/getting-started/free-trial).
- [Firebase SMS limits](https://firebase.google.com/docs/auth/limits).
- [Supabase phone login](https://supabase.com/docs/guides/auth/phone-login).
- [T-Mobile non-consumer messaging](https://www.t-mobile.com/support/plans-features/consumer-versus-non-consumer-text-messaging) and [carrier terms](https://www.t-mobile.com/responsibility/legal/terms-and-conditions) demonstrate why a gateway vendor's marketing claim cannot establish carrier permission. Do not distribute traffic across SIMs/accounts to evade limits.

### Recommended zero-additional-cost MVP path

Use existing password login and persistent sessions for returning users, with incoming/outgoing activity visible in My Rentals. A persistent in-app unread activity feed would avoid per-message costs; it does not notify someone whose app is closed. Keep the currently working email verification while assessing a sustainable onboarding/recovery option. This is a recommendation, not an unannounced auth replacement.

Do not call SendGrid permanently free: [its free plans were retired](https://www.twilio.com/en-us/changelog/changes-coming-to-sendgrid-s-free-plans), and new accounts get a [60-day trial](https://www.twilio.com/docs/sendgrid/ui/account-and-settings/upgrading-your-plan). Password logins do not send messages, but new-user verification/password recovery still need an email service or an explicitly designed manual verification process. A strict zero-recurring-cost pilot can use manually verified Georgia Tech invitations and existing passwords; that requires an explicit onboarding design, not removal of verification.

If reconsidering TextBee, first supply an already-owned dedicated Android device and a carrier plan explicitly permitting this automated transactional use. Then verify the account email, pair the device, store the API key only in Vercel server environment variables, implement signed webhook/STOP handling and shared monthly quotas, and test actual receipts on consented US phones before changing authentication. No account, hardware, credentials, or real delivery test exists for a replacement yet.
