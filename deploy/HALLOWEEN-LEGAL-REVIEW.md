# Halloween and legal review — not deployed

Changes live in `artifacts/production-release`, branch `review/halloween-legal`, based on the last deployed release `7422100`. The surrounding Toga2 workspace contains separate unreleased SMS work; it has not been overwritten or deleted. This is the reviewed production-source checkout, not a deployment. There is no Git remote configured, so no push was attempted. The legal request explicitly says to review before deployment; neither production migrations nor Vercel deployment were run.

## Theme and coverage

`app/globals.css` holds semantic background, surface, text, primary, on-primary, border, error, and shadow tokens. Existing cream/burgundy aliases keep the components compatible. `app/seasonal.css` applies the dark charcoal/burgundy palette, cream text, warm orange accents, raised cards, and form focus/border treatments. All marketplace views use these shared styles, including authentication, code verification, browse/detail, listing creation, My Listings, Rentals and actions, account/payment information, reports, ratings, admin, errors, and loading states. Public legal pages and the acceptance gate use the same tokens.

`components/seasonal-decor.js` contains lightweight inline moon, web, ghost, and bat SVGs. Ghost float, occasional bat drift, and a localized landing glow use CSS transform/opacity animations; button/card hover effects remain subtle. Decorations are aria-hidden, unfocusable, pointer-events:none, and outside the clothing-image layer. No uploaded images are modified. There are no animation dependencies, JavaScript animation loops, GIFs, videos, or added services. The mobile layout hides the ghost. Reduced-motion CSS disables animations/transitions, including pseudo-elements.

Set `TOGA_THEME=classic` and rebuild/restart to restore the ordinary theme and hide all seasonal decorations. Halloween is explicitly selected by default in this review, not controlled by a client clock or automatic date rollover. Marketplace logic does not depend on the theme.

## Cleanup audit and decisions

- Removed the unreferenced SendGrid adapter (`lib/sendgrid.mjs`) and its isolated tests. Active Gmail delivery remains behind `sendMailMessage`; rental templates remain centralized in `notificationMail`, and the transactional outbox still handles delivery claims/retries.
- Removed 139 unused marketing CSS rules after tracing their selectors against the rendered components (old photo collage, hero, trust strip, lend banner, obsolete filter/sort controls). No current listing photos or controls were removed.
- Removed High-Value admin tab/filter branches and automatic flag calculation. The database column, historical migrations, and SQLite import compatibility remain intact for rollback/data preservation. No destructive database cleanup.
- Kept `paymentInfo` as the canonical input/display field. Historical Venmo backfill/import code remains, as does the stale-client rejection preventing obsolete `venmoHandle` submissions from overwriting profile information. Venmo is only one optional payment example, alongside cash, PayPal, and Zelle.
- Kept email OTP, passwords, magic-link compatibility, `EmailOtp`, `LoginToken`, sessions, Gmail transport and the Email outbox: production still needs them. SMS is not active in this checkout; pending Twilio code and database columns in the surrounding workspace were not assumed to be dead.
- Kept the admin Emails label because production notifications are email-based. Displayed authentication emails are deduplicated to the latest event per recipient; rental emails are not deduplicated away. Queries remain bounded to the latest 50 email records, so this is not a full historical audit log.
- Corrected stale current-provider wording in README/deployment instructions. Historical SendGrid documents remain explicitly superseded. Added an inactive-production notice to SMS documentation.
- No dependencies removed: Nodemailer, Prisma, Next/React, Sharp, Lucide, Tailwind/PostCSS, and local Postgres tooling still have uses. No dependency added.
- Moved the existing client marketplace from `app/page.js` into `components/marketplace.js`; the new small server page enforces the legal gate. This preserves the existing marketplace implementation rather than rewriting its flows.

## Legal behavior

Public `/terms`, `/privacy`, `/safety` pages and `/accept-terms` carry the requested draft notice. `lib/legal.mjs` is the single source for document versions and acknowledgement copy. Versions are `2026-10-15-v1`.

The server page redirects logged-in users missing current terms/privacy/adult confirmation to `/accept-terms`. Protected APIs independently return 428 until acceptance is recorded. Public legal pages, authentication/logout, the authenticated user's own session metadata, and authenticated cron operations remain accessible as appropriate. Client refresh/error handling follows the server gate. Users cannot bypass it by directly requesting listings, uploads, requests, ratings, reports, or admin data. Existing 30-day session cookies and daily rolling renewal remain in place.

Listing creation/editing requires the ownership, cleanliness, hazards, and prohibited-items confirmation; the server writes the timestamp. Rental creation requires the boolean acknowledgement, current terms version, and matching replacement value. It records the time/version and a snapshot of the agreed replacement amount. Competing listing changes fail the reservation rather than silently changing the value. Safety links/tips appear on rental cards, and reports explain good-faith mediation and invite photos. Admin users see current/update-required/missing legal status, version/time, and request acknowledgement evidence.

The privacy draft describes actual current behavior: Gmail is current; SendGrid is historical; SMS is unreleased; image storage is private with authenticated serving and additional access checks. It does not falsely promise public buckets, active private messaging, automatic fixed retention, or completed DMCA registration.

## Placeholders and decisions before publication

Fill every occurrence of:

- `[ENTITY NAME]`
- `[CONTACT EMAIL]`
- `[GOVERNING STATE]`
- `[DISPUTE RESOLUTION]`
- `[DMCA AGENT NAME / ADDRESS / PHONE / EMAIL]`
- `[RETENTION SCHEDULE]`

TODO comments in Terms/Privacy identify the placeholders. The footer links Contact to the public privacy contact section instead of constructing an invalid placeholder email link.

Attorney review is still required. This implementation records acknowledgements and supplies draft language; it does not establish that liability exclusions or indemnification are enforceable. Finalize dispute handling, retention, and DMCA procedures/agent registration before publishing those claims. Reference checks: [FTC privacy guidance](https://www.ftc.gov/business-guidance/privacy-security/consumer-privacy), [Copyright Office agent designation](https://copyright.gov/dmca-directory/).

The existing replacement-value field remains optional to preserve the current listing flow. Blank means $0.00, and the renter sees that amount explicitly. Decide whether replacement value should become mandatory before launch. Existing rentals and listings keep nullable acknowledgement fields: no consent or amount is invented retroactively. Older listings prompt confirmation when edited, but are not automatically delisted.

## Migrations

Both migrations are additive and tested only against local Postgres:

1. `20261015010000_legal_acceptance`: nullable user acceptance/age/version fields, listing lender confirmation, and rental acknowledgement time/version.
2. `20261015011000_rental_replacement_snapshot`: nullable rental acknowledged replacement amount.

No production data was changed. After review, from this checkout with the intended production environment file:

```sh
node --env-file=../../.env.production.local node_modules/prisma/build/index.js migrate deploy
```

Then generate/build/deploy the reviewed commit through the existing deployment process. Do not use `db push`, reset, or seed against production. The last production release remains unchanged until that separate deployment. The review app requires these migrations; do not deploy the app without applying them first.

## Validation

- ESLint passed.
- Unit tests passed (20 tests after obsolete SendGrid-only tests were removed).
- Prisma validation and client generation passed.
- Next production build passed, including its code/type-validity stage. This is a JavaScript repository with no TypeScript configuration or independent `tsc` check; no claim of strict static typing.
- Local legal integration: logged-out legal routes; new and existing accounts gated at server page and APIs; acceptance cannot omit checkbox or use old versions; session continuity; privacy-version reacceptance; listing acknowledgement rejection; rental acknowledgement rejection; changed replacement value rejection; timestamp/version/amount stored.
- Full marketplace regression: exact-domain auth, scanner-safe links, uploads/access checks, concurrent reservations/reminders, incoming/outgoing access, accept/decline, pickup/return, ratings, reports, cancellation/expiry, rate limits, CSRF, logout, legacy-session rejection.
- OTP regression: cooldown, attempt limits, expiry, resend invalidation, atomic one-time use, redacted email history, persistent/renewed sessions, logout.
- Password regression: setup/login/recovery, session revocation, hash redaction, rate limiting.
- Activity/session regression: 30-day creation/renewal, expiry/logout, incoming/status/expiry notices, cross-user isolation, cross-device unread persistence, marking shown IDs without clearing newer updates.
- Browser review at 360×800, 430×932, 768×1024, and 1440×1000: landing/auth/code input, legal gate/public Terms, browse/cards/detail/rental form, create listing, account/payment form, My Listings, received/completed rentals, unread banner, report/rating dialogs, and admin records. No application console errors observed. Mobile page width checked without horizontal overflow; admin tables deliberately scroll within their container.
- Measured dark-theme contrast: primary text/surface 14.53:1; muted text/surface 8.22:1; button text/fill 8.98:1; strengthened input border/surface 3.44:1. Reduced-motion protection checked in CSS; OS reduced-motion emulation was not performed.
- Preview listing images use the Toga logo in disposable local fixtures; real student images were not accessed or altered for these checks. No live email or SMS sent.

Screenshots in the surrounding workspace: `artifacts/halloween-browse-desktop.png`, `artifacts/halloween-rentals-mobile.png`, `artifacts/halloween-acceptance-mobile.png`.

## Deployment and remaining debt

No deployed commit for this change. No live desktop/mobile verification of this theme, because deployment is intentionally withheld. No remote configured for push. The existing live URL still runs the preceding release.

The separate root SMS implementation should eventually be reconciled into a single source tree through its own tested rollout. Do not deploy the root tree accidentally. Legacy physical Venmo/High-Value/SMS columns remain pending a deliberate backup/rollback/data audit. The admin email display is bounded, not a complete searchable audit trail. Google Fonts still loads externally, and the existing minimal ESLint configuration lacks the Next plugin. Those are documented limitations, not reasons to replace the app's architecture in this change.

## Changed files

- `README.md`
- `app/accept-terms/page.js`
- `app/api/[...path]/route.js`
- `app/globals.css`
- `app/layout.js`
- `app/page.js`
- `app/privacy/page.js`
- `app/safety/page.js`
- `app/seasonal.css`
- `app/terms/page.js`
- `components/accept-terms.js`
- `components/auth-form.js`
- `components/forms.js`
- `components/legal-document.js`
- `components/legal-footer.js`
- `components/marketplace.js`
- `components/seasonal-decor.js`
- `components/ui.js`
- `deploy/HALLOWEEN-LEGAL-REVIEW.md`
- `deploy/README.md`
- `deploy/SMS.md`
- `lib/legal.mjs`
- `lib/page-session.js`
- `lib/sendgrid.mjs`
- `next.config.mjs`
- `prisma/migrations/20261015010000_legal_acceptance/migration.sql`
- `prisma/migrations/20261015011000_rental_replacement_snapshot/migration.sql`
- `prisma/schema.prisma`
- `scripts/verify-hosted.mjs`
- `scripts/verify-payment.mjs`
- `tests/activity-session-integration.mjs`
- `tests/integration.mjs`
- `tests/legal-integration.mjs`
- `tests/legal.test.mjs`
- `tests/otp-integration.mjs`
- `tests/password-integration.mjs`
- `tests/sendgrid.test.mjs`
