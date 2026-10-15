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
