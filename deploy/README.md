# Vercel + Supabase deployment

Do not open the waitlist until the final verification below passes. The local build and local Postgres tests are not evidence of a completed hosted deployment.

## 1. Connect accounts and create resources

Authenticate locally with `npx vercel login` and `npx supabase login`. Neither CLI login grants access to the database password automatically. Create a Supabase project in a nearby US region and a Vercel project for this repository. Keep the initial production deployment empty until configuration and migrations are ready.

Use the Vercel project's assigned `*.vercel.app` address; availability of any specific name is not guaranteed. No custom web domain is required. Set Node.js to 22.x. The app uses `vercel.json` with a 60-second API duration and the `iad1` region.

Do not provision paid resources or upgrade plans without deciding on the cost first. Check Vercel's plan terms for the marketplace's intended commercial use; a Hobby account is not a promise of free production hosting for all uses.

## 2. Configure secrets

Copy `.env.production.example` to `.env.production.local` and populate it locally. This file is ignored by Git and Vercel uploads. Set the same variables in the Vercel project's **Production** environment; configure an isolated Supabase project for Preview if enabling preview deployments.

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Supabase transaction-pooler URI (port 6543), with `pgbouncer=true`, `connection_limit=3`, `pool_timeout=20`, `schema=toga`, and `sslmode=require`. |
| `DIRECT_URL` | Supabase session-pooler URI (port 5432) or direct IPv6 URI, with `schema=toga&sslmode=require`; used for migrations. |
| `APP_URL` | Exact canonical HTTPS Vercel origin, with no path or trailing slash. |
| `ADMIN_EMAIL` | `jointoga@gmail.com`; this exact address has an explicit login exception. Admin role is refreshed at sign-in. |
| `EMAIL_PROVIDER` | `gmail`. |
| `GMAIL_USER` | `jointoga@gmail.com`. |
| `GMAIL_APP_PASSWORD` | Server-only Google App Password, entered using the local secrets script. |
| `EMAIL_FROM` | The Gmail sender address matching `GMAIL_USER`, without a display name. |
| `TOGA_THEME` | `halloween` for this release; `classic` plus redeployment restores the original theme. |
| `TOGA_RELEASE_SHA` | Git commit deployed by the CLI release workflow. |
| `DEV_EMAIL_PREVIEW` | `false`. |
| `CRON_SECRET` | At least 32 random characters. |
| `STORAGE_DRIVER` | `supabase`. |
| `SUPABASE_URL` | The project's HTTPS origin. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only service-role key; never prefix with `NEXT_PUBLIC_`. |
| `SUPABASE_STORAGE_BUCKET` | `toga-photos`. |

Use the actual pooler host shown in Supabase's **Connect** panel. URL-encode the database password. Keep all credentials in environment settings, never in chat, source code, or command-line arguments.

Complete [Gmail SMTP setup](GMAIL.md) before deploying the Gmail release. Test real delivery and Inbox/Junk placement at Georgia Tech. This app retains its custom email-code/password auth and uses Supabase for Postgres/Storage only.

## 3. Apply migrations and set up storage

```sh
node --env-file=.env.production.local scripts/check-production.mjs
node --env-file=.env.production.local node_modules/prisma/build/index.js migrate deploy
npm run storage:setup
```

Migrations create a dedicated `toga` schema and revoke access from public/client roles. **Do not add `toga` to Supabase's exposed Data API schemas.** Prisma uses the server connection; the browser never queries the database directly.

The storage setup script creates/verifies a private bucket restricted to WebP objects. Leave it private and do not add anonymous read/write policies. Photos are authorized and proxied by the Next.js API.

The app does not rely on Vercel's local filesystem. Ensure `STORAGE_DRIVER=supabase` in every hosted environment. The production configuration check rejects local storage and development login previews.

For the current SQLite demo database, no live data needs copying. For another dataset, run the importer dry run before any import. Do not run `prisma migrate reset` on a hosted database.

## 4. Deploy

```sh
npx vercel link
# Add Production variables through Vercel's dashboard or secure CLI input.
npx vercel --prod
```

The configured build runs `npm run build:vercel`, which checks required settings and generates Prisma before building. Migrations are deliberately a separate step; preview builds must never migrate the production database.

If the assigned canonical URL changes, update `APP_URL` and redeploy. All student links must use that origin. Keep aliases on the canonical origin to avoid cross-origin request rejection. Configure deployment protection for staging as appropriate; the live student origin must be accessible to the waitlist.

## 5. Schedule background work

Enable Supabase `pg_cron`, `pg_net`, and Vault. Store `toga_app_url` and `toga_cron_secret` in Vault, then run `deploy/supabase-cron.sql` in the Supabase SQL editor. This calls the protected job every 15 minutes. Do not put literal secret values into the SQL file.

Inspect `cron.job_run_details` and `net._http_response` after the first run. A scheduled SQL invocation alone does not prove that the HTTP request succeeded. Check the returned HTTP status and `/api/jobs` result. Vercel deployment protection must not block this production endpoint.

Vercel Hobby's once-daily cron is not frequent enough for the MVP's timing; the Supabase schedule avoids that limit. Keep only one logical schedule, although atomic database claims also guard concurrent executions.

## 6. Verify the hosted app before inviting students

```sh
npm run verify:hosted
```

This checks the actual Vercel origin, database session reads, object storage, private image authorization, and domain rejection. The script uses and removes temporary verification data and does not email synthetic addresses. Use a Vercel automation bypass secret only if testing a protected staging deployment; set it locally, never in the client.

Then use **two real controlled Georgia Tech email accounts** in separate browser sessions:

1. Request magic links; confirm delivery to both inboxes and verify each link can be used only once. Verify another domain is rejected.
2. Complete minimal profiles. Upload a real photo on a phone, publish a listing, and reload its image after a deployment/restart.
3. Confirm category/size/price/search filters find the listing and My listings permits edits/removal when available.
4. Send a rental request from the second account. Confirm it appears under Sent and Received, and that phone numbers are hidden before acceptance.
5. Accept as lender. Confirm both numbers and the rental total, then exercise pickup, condition photos, return, and rating.
6. Send another request and decline/cancel it; verify availability returns. Check expiration and scheduled reminder delivery with controlled test dates.
7. Submit a test report and confirm that the founder can see it and another student cannot.
8. Check Vercel function errors, Supabase database health, Gmail SMTP delivery status, and cron HTTP results. Keep actual student data out of logs.

Do not label deployment complete before this hosted walkthrough succeeds. These manual inbox/browser checks cannot be replaced by the local integration suite or the hosted smoke test.

After verification, remove the identified prelaunch accounts, listings, requests, reports, ratings, condition checks, email records, tokens, sessions, rate limits, and their Storage objects. Do not seed or import the old demo database. Run this read-only launch gate against production:

```sh
node --env-file=.env.production.local scripts/check-launch-empty.mjs
```

Confirm the photo bucket is also empty. Then check the actual public Vercel URL at phone widths (including 390px): navigation, forms, image uploads, friendly errors, no horizontal overflow, broken links, console errors, or placeholder content. Record these results before sharing the URL. Once real students join, never empty the database to repeat this prelaunch check.

## 7. Operate and recover

- Export/back up Postgres before schema changes; arrange backup retention appropriate to the Supabase plan. Verify a restore on an isolated database.
- Back up Storage objects separately: a database backup alone does not contain photo bytes.
- Keep environment variables and a record of the deployed Git revision. A Vercel rollback reverts code, not database migrations; prefer forward database fixes after data has been written.
- Monitor Gmail SMTP failures, Supabase storage usage, and request errors. Emails marked Failed/Unknown or older than the retry window need founder follow-up in the Gmail sender mailbox; they remain visible in the admin table. An Accepted status means Gmail accepted the message, not that Outlook placed it in the inbox.
- The service-role key can access Storage broadly. Rotate it through provider tooling if compromised, and update Vercel before reopening the app.

References: [Supabase Prisma connections](https://supabase.com/docs/guides/database/prisma), [private Storage](https://supabase.com/docs/guides/storage/serving/downloads), [Supabase Cron](https://supabase.com/docs/guides/cron), [Vercel function limits](https://vercel.com/docs/functions/limitations), [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).
