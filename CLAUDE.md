# Toga — instructions for Claude Code

Toga is a peer-to-peer clothing rental marketplace for Georgia Tech students. **https://jointoga.com is LIVE production with real users and data.**

## Hard rules
- Never reset, truncate, seed, or run destructive commands against the production database. Never run `prisma migrate reset`, `prisma db push --force-reset`, or `prisma migrate dev` against a production `DATABASE_URL`.
- Migrations must be safe and additive (new nullable columns/tables; no drops or renames of live data without an explicit plan).
- Never commit or print secrets. `.env*` files are gitignored; only `.env.example` (placeholders) is tracked.
- Do not deploy, change Vercel/Supabase/Resend/DNS settings, or env vars unless the user explicitly asks. Test locally before any production deployment.

## Source of truth
- GitHub repo, branch `main`. Work on feature branches and open PRs into `main`.
- Stack: Next.js 15 + React 19, Prisma 6, Supabase Postgres (schema `toga`) + private Supabase Storage, Vercel, Resend.
- Auth: verified `@gatech.edu` email + password (plus founder exception `jointoga@gmail.com`). Email is sent via Resend from `login@jointoga.com`.
- The old SMS/Twilio implementation (and SendGrid/Gmail paths) are abandoned — don't revive them.
- `/api/health` on production reports the deployed release hash.

## Local dev
`npm ci`, `cp .env.example .env`, `npm run db:local` (separate terminal), `npm run db:deploy`, `npm run dev`. See README.md and `deploy/` for details.
