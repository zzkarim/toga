# Gmail SMTP setup and verification

Toga sends through Gmail as **Toga <jointoga@gmail.com>**, using Nodemailer over TLS on port 465. A single provider function (`lib/mail-provider.mjs: sendMailMessage`) isolates delivery from authentication and rental logic. The existing outbox and `sendEmail`/`deliverEmail` entry points remain. There are plain-text and HTML alternatives, no remote images, no tracking pixels and no rewritten tracking links. User-provided text is HTML-escaped. Credentials and SMTP response text are never sent to the frontend or logged.

## Owner setup (do not put credentials in chat)

1. Sign into **jointoga@gmail.com**, checking the Google account avatar so you do not configure a different account.
2. Open https://myaccount.google.com/security → **How you sign in to Google** → **2-Step Verification**. Complete enrollment using Google's prompts.
3. Open https://myaccount.google.com/apppasswords. Reauthenticate if requested. Name the app **Toga production** and create the App Password.
4. From `/Users/zayankarim/Desktop/Toga2`, run:
   ```sh
   python3 scripts/configure-production-secrets.py --gmail-only
   ```
5. Paste the generated 16-character **App Password** at the hidden terminal prompt. Spaces in Google's grouped display are removed. Do not enter your ordinary Google account password.
6. Tell the deployment operator that it is saved. The script atomically stores it in ignored `.env.production.local` with mode 0600; it does not upload or print it.

The script writes `EMAIL_PROVIDER=gmail`, `GMAIL_USER=jointoga@gmail.com`, `EMAIL_FROM=jointoga@gmail.com`, and `GMAIL_APP_PASSWORD`. Only the last value is secret. Vercel must receive them as server-only Production environment variables, followed by a new deployment. Keep the old deployment active until Gmail authentication has passed. Do not enable a blank or fake password in production. The SendGrid key is no longer used by the replacement.

If App Passwords is unavailable, Google's documented reasons include Advanced Protection, some organization-managed accounts, or 2-Step Verification configured only with security keys. Do not disable account security to work around it. Changing the Google account password revokes App Passwords; create a replacement when needed.

Source: [Google App Password instructions](https://support.google.com/accounts/answer/185833?hl=en).

## Checks

Using Node 22 with the root secrets file (never echo the file):

```sh
node --env-file=.env.production.local artifacts/production-release/scripts/check-gmail.mjs
node --env-file=.env.production.local artifacts/production-release/scripts/send-mail-test.mjs authorized-recipient@gatech.edu
```

The first command authenticates without sending. The second sends one authorized test with a unique reference. SMTP acceptance does not prove inbox delivery. Open the recipient's Outlook Inbox and Junk folders, find the reference, and inspect message details/Authentication-Results for SPF, DKIM and DMARC where available. Record the observed folder; do not claim success based only on Gmail's Accepted result.

Gmail sending uses Google's authorized infrastructure for the Gmail From address, addressing the SendGrid/Gmail sender mismatch. It cannot guarantee Outlook inbox placement or override Georgia Tech filtering. A personal Gmail account has sending limits (Google documents blocking after more than 500 messages/day), and Gmail may reject a new server login. This is a low-volume MVP option, not a delivery SLA. [Nodemailer Gmail guide](https://nodemailer.com/guides/using-gmail), [Google sending limits](https://support.google.com/mail/answer/22839).

## In-app activity and sessions

RentalActivity records are created transactionally for new incoming requests, partner status changes and request expiry. Each account gets an unread count and a Rentals-page banner, polled every 30 seconds while visible and on focus. Mark-as-read updates only that user's displayed IDs; updates arriving afterward remain unread. The activity feed works independently of SMTP success, and unread state persists across devices.

Login sessions use a 30-day HttpOnly, SameSite=Lax, production-Secure cookie backed by a hashed-token database record. Active sessions are renewed to 30 days when less than 29 days remain. Logout, password changes, cookie deletion and expiration can require login again. This does not promise persistence in private browsing or after a user logs out.

## Verification reliability and bounce checks (October 2026)

SMTP acceptance is **not delivery**. The admin email panel calls it “Provider accepted (delivery unconfirmed).” `sentAt` records SMTP acceptance time, not inbox arrival. No code path records Delivered. Explicit SMTP rejection is Failed (authentication) or Retry (non-auth temporary rejection); ambiguous transport errors are Unknown and never retried automatically. Numeric SMTP/enhanced status codes are retained, but arbitrary provider text and original authentication bodies are not logged.

Verification runs immediately, outside the notification retry queue. A database advisory lock prevents simultaneous requests for one address from sending duplicate codes. The 60-second cooldown runs before the five-sends-per-15-minutes email quota, so blocked repeat clicks do not consume that quota. On Vercel, the platform-provided `x-vercel-forwarded-for` also limits each IP to 60 requests per 15 minutes; a global 100/minute ceiling remains. A failed resend keeps a previous unexpired code usable. Codes expire after ten minutes and are single-use. Existing password login and session behavior are unchanged.

The same Gmail App Password supports read-only TLS IMAP on port 993. No additional credential or schema migration is needed. `lib/gmail-bounces.js` checks the INBOX for up to 30 newest Google failure notices from the last seven days, at most once per minute across instances and with a 12-second connection budget. Checks run during pending-code polling, scheduled jobs, or the admin “Check delivery failures” action. Pending-code polling starts after 15 seconds, then runs once per minute while the tab is visible and the challenge is valid. This is a bounded, opportunistic monitor, not a real-time Gmail webhook or complete mailbox archive scan. Archived/deleted, oversized, older, delayed, or unsupported notices can be missed. A successful scan with no match does not establish delivery.

Only multipart/report delivery-status notices from Google's mailer-daemon, with Google's receiving Authentication-Results showing Google DKIM/DMARC pass and an empty return path, are parsed. A permanent failed status, original Toga Message-ID, and exact recipient must match the outbox. Matches change Accepted/Unknown to Bounced; repeated scans are idempotent. Original message bodies/OTPs are neither stored nor returned. IMAP unavailability does not stop code entry or password login. Admins can retry or inspect Gmail manually. Do not mark a message Delivered based on the absence of a bounce.

Non-auth retries retain their original outbox ID, are limited to five attempts and a 23-hour window, and use an atomic send claim. Stale in-flight records become Unknown rather than being resent. Stale authentication queue records fail after two minutes; authentication bodies are redacted and cannot safely be replayed. Admin copies retain deterministic event IDs and remain fail-soft for marketplace transactions.

Incident evidence: five authenticated Gmail failure notices reported `Action: failed`, `Status: 5.7.1`, and the generic “Message rejected” Google help link after SMTP acceptance. One was addressed to the Gmail sender itself. The inspected seven-day outbox had 67 messages, each with one attempt, and no retry amplification. This establishes asynchronous Google policy rejection, not its precise cause, and does not establish a GT-only block or a daily quota violation.

Gmail API/OAuth is a legitimate alternative, but no evidence here establishes that switching transport would avoid this policy rejection. Google documents that sending limits are shared across API/SMTP/other clients. Keep the existing authenticated SMTP transport while testing actual receipt; neither code changes nor a clean template guarantees inbox delivery.

References: [Google rejection guidance](https://support.google.com/mail/answer/6596), [Google API sending limits](https://developers.google.com/workspace/gmail/api/guides/handle-errors), [Google App Passwords](https://support.google.com/accounts/answer/185833), [Vercel request headers](https://vercel.com/docs/headers/request-headers).

Local failure coverage: `tests/gmail-dsn.test.mjs`, `tests/mail-provider.test.mjs`, and `tests/verification-failure-integration.mjs`. Run the latter only against local Postgres with live credentials absent and the email-preview development server running; it never sends a real email. Real acceptance/arrival/bounce evidence must still be collected separately from an authorized recipient mailbox.

## Temporary password signup pilot

Set `REQUIRE_EMAIL_VERIFICATION=false` in Vercel Production and redeploy to enable password-only signup. The server and server-rendered auth form use the same flag. No schema migration, credential reset, or session invalidation is required. Email ownership is NOT verified in this mode; only the campus domain is validated. Set `true` and redeploy to restore code signup; do not remove the Gmail monitor.

Normal signup sends no code. Explicit recovery for existing accounts can still attempt a code; its proof requirement is never bypassed. Already-authenticated passwordless users can establish their first password from Account during the pilot. Forgotten-password recovery still depends on successful verified email or careful administrator-assisted ownership checks; knowledge of an email alone never permits resetting an existing account.

Admin signup/login monitoring and marketplace notifications run after successful core responses. Failures are secondary; sessions, accounts and rental state remain saved. No sign-in email is generated for refresh or session renewal. Monitoring payloads contain only identity and timestamp, never credentials, session tokens, cookies, or IP addresses. All existing bounce diagnostics and retry bounds remain.
