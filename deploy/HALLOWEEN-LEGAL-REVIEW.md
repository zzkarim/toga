> Historical review. See [production release results](PRODUCTION-RELEASE.md) for the subsequent deployed release.

# Halloween and unincorporated-service review — not deployed

This continues `review/halloween-legal` from `4032593` in `artifacts/production-release`. The live release remains unchanged. No production migrations, deployment, real emails, or SMS were performed. The surrounding root workspace's unreleased SMS implementation and all real payment data remain untouched.

## Legal structure and publication decisions

Toga is described as an individually operated, unincorporated service. Terms sections 1 and 8 and the Privacy opening no longer assume an unnamed company or its personnel. Contractual disclaimers do not create an entity-based liability shield. No personal name or address was inserted.

Two factual placeholders remain, centralized in `lib/legal-config.mjs`:

- `LEGAL_OPERATOR_NAME`: the approved legal name of the individual operating Toga. This identifies who supplies the service and handles personal information; have counsel confirm the required disclosure for the operator's circumstances. No home address is requested or embedded by this implementation.
- `LEGAL_GOVERNING_JURISDICTION`: the jurisdiction selected after considering where the operator resides/operates and mandatory consumer law. The Georgia Tech pilot does not make this decision automatically. Confirm the choice with counsel.

`LEGAL_REVIEW_APPROVED=true` is an explicit publication approval switch, not a claim that software can determine legal compliance. Leave it unset until the final documents and actual operating practices are reviewed. Rebuild after filling public legal values; legal pages are prerendered.

`jointoga@gmail.com` is centralized in `lib/contact.mjs` and used for legal/privacy/safety/support/account contact and the existing contacts note. Provider authentication and the exact admin email exception remain separately constrained; changing a contact address must not silently change who can administer Toga.

The dispute draft uses a factual email report, clarification, and optional good-faith help communicating. It does not impose arbitration, class-action waiver, jury-trial waiver, exclusive venue, binding mediation, or a guaranteed outcome. Attorney review is needed for liability exclusions, indemnification, loss/damage responsibilities, eligibility, moderation, privacy/deletion practices, and jurisdiction. This is implementation of a draft, not a legal opinion on enforceability.

Copyright complaints can go to the ordinary contact address. There is no fake agent, address, registration, or safe-harbor claim. If seeking the applicable Section 512 protection, review all conditions with counsel, designate an agent, publish the required contact information, register matching information with the Copyright Office, and implement the appropriate notice/counter-notice and repeat-infringer procedures. Registration alone is not the whole compliance process. See the [Copyright Office guidance](https://www.copyright.gov/dmca-directory/).

The platform distinction remains explicit: no ownership or universal inspection of clothing, physical exchange/delivery, insurance, deposits, or payment processing. Users arrange rentals, payment, pickup, and returns directly.

## Publication safeguards and acceptance

Vercel configuration rejects an unreviewed legal configuration even if someone bypasses the usual `build:vercel` command. `check-production.mjs` validates the same requirements. A manually run production build with missing facts renders a neutral publication-review notice rather than legal placeholders. Its acceptance endpoint returns 503, and the acceptance page does not offer a false agreement. Local development shows clearly labeled drafts. `LEGAL_DRAFT_PREVIEW=true` can expose labeled documents in a local production preview, but does not bypass Vercel or API approval checks; do not set it on public deployments.

Terms and Privacy versions are now `2026-10-15-v2`. Server-page redirects and protected API 428 responses still require current acceptance, dated adult confirmation, and both document versions. Rental acknowledgments retain the user/request association, timestamp, terms version, and replacement snapshot. No additional IP, device fingerprint, or legal-only telemetry was added. Current user acceptance is stored on the user record; this is not a full append-only history of every past acceptance. Rental snapshots remain historical records.

Legal pages now include an anchored table of contents, readable line length and spacing, and mobile typography. No automatic publication occurred.

## Actual retention framework

This describes the inspected schema and `lib/jobs.js`, not a new automatic purge policy. The [FTC's privacy guidance](https://www.ftc.gov/business-guidance/privacy-security/consumer-privacy) emphasizes honoring actual privacy promises.

| Data | Current behavior | Manual review / proposed future policy (not automatic) |
| --- | --- | --- |
| Accounts, campus email, name, user-entered phone, optional year/photo, payment instructions | Persist until reviewed deletion; phone is not independently verified in this release | Review verified closure requests; remove unnecessary profile/payment fields after resolving open rentals and narrowly document any holds |
| Listings and photos | Database records plus private storage objects; no age-based purge | Review withdrawn/closed listings and orphaned uploads; implement a coordinated database/storage deletion tool before promising a deadline |
| Requests, completed rentals, ratings, condition photos, problem reports | Persist; no fixed automatic retention period | Retain only what is needed for active disputes/safety/legal obligations; set a period after jurisdiction and legal advice are known |
| Rental activity/read receipts | Persist with requests; no age-based purge | Consider a bounded post-rental retention period together with rental records |
| Notifications and delivery metadata | Outbox stores recipient, content for transactional messages, status, attempts/errors; no general purge | Suggested engineering target: review 90-day notification/log retention, exceptions and provider copies before implementing; not a current user promise |
| Sessions and magic-link tokens | Maintenance deletes expired records | Session expiry is still 30 days with rolling renewal; expired records can remain until the job runs |
| Email verification codes | Maintenance deletes records expired for more than one day | Hashed/bound codes, not raw stored codes; delivery content is redacted |
| Rate-limit records | Maintenance deletes records whose reset time passed | Operational logs may also exist at the hosting provider |
| Stored magic-link emails | Maintenance deletes entries older than 15 minutes | Job-based cleanup, not an exact-time guarantee |
| Legal acceptance and rental acknowledgment | Persist; current acceptance on user, rental acknowledgment on request | Decide retention with counsel; do not invent acceptance or erase evidence blindly |
| Support email/provider logs/backups | Outside the application's automatic deletion logic | Inventory Gmail, historical SendGrid, Vercel and Supabase policies/settings; document feasible deletion and backup lifecycle before publishing any fixed deadline |

Operational handling: verify the requester owns the account; identify associated records/uploads and open rentals; assess specific dispute/security/legal holds; explain retained categories and reasons; delete eligible records and storage objects coherently; record completion without retaining unnecessary copies. This is a recommended operator workflow, not a new automated account-deletion feature or a guaranteed response-time policy. Maintenance cleanup depends on the existing jobs runner actually being scheduled and monitored.

## Replacement value

Blank, omitted, whitespace-only, or null means `null` / **Not specified**. Explicit `0` stays zero. Invalid types, non-finite numbers, negative values, and amounts above $10,000 are rejected. Values are rounded to cents.

Listing forms preserve zero with nullish handling. Rental requests compare the submitted value with the current listing, including null, and use it in the conditional reservation update. The immutable acknowledgment snapshot preserves null rather than coercing it to zero. Missing-value copy explicitly says no fixed replacement amount is agreed here. Older acknowledgment records without a recorded amount remain labeled separately from new unspecified amounts.

Historical listing zeros are preserved: the old API collapsed blanks and zeros, so their original intent cannot safely be inferred. Do not bulk-convert or invent values; an owner can clear the field when editing. Tests cover new missing values, explicit zeros, stale-value mismatches, and null/zero rental snapshots.

New migration: `20261015012000_nullable_replacement_value` drops only the Listing retailValue NOT NULL constraint. It does not delete or rewrite data. Applied and tested locally only. The two prior review migrations (legal acceptance and rental replacement snapshots) are also still required before a future production rollout.

## Halloween implementation

`SeasonalProvider` receives the server-selected mode. `TOGA_THEME=halloween` (the review default) enables dark charcoal/burgundy surfaces, cream text, orange accents and decorations. `TOGA_THEME=classic` restores the original palette and returns no decoration markup, not merely hidden animation elements. Rebuild/restart to switch.

Reusable SVG glyphs compose hero, authentication, navigation, and empty-state scenes: cratered moon, several friendly ghosts, small bat groups, corner webs, a hanging spider, jack-o'-lantern and localized gradient fog. Authentication and empty states reserve illustration space above text/controls; hero artwork stays in surrounding space. Navbar decoration is compact. Admin contains only the quieter shared navigation decoration; no animated table overlays.

CSS varies bat paths/durations/delays, ghost float/rotation, spider sway, pumpkin light opacity, fog drift and landing glow. Buttons/cards lift slightly and glow on hover; inputs gain focus glow. Photos have no filters or overlays. All decoration is aria-hidden, unfocusable, pointer-events:none. No animation library, per-frame React state, JS loop, remote image, or new service was added.

Phones omit extra bats and hero ghosts, shrink the moon/web/pumpkin, and reduce fog height. `prefers-reduced-motion: reduce` disables animations, transitions, smooth scrolling, and hover translation while retaining static artwork. CSS protections were inspected; OS/browser reduced-motion emulation was not performed.

## Cleanup and preserved compatibility

This continuation removes the superseded single-bat/single-ghost decoration markup, old positioning rules/keyframes, entity/contact/DMCA/retention placeholders that now have accurate replacements, and obsolete speculative Twilio-provider prose. No additional live feature or dependency was deleted without usage evidence.

The previous commit's SendGrid adapter/tests, dead marketing CSS and High-Value admin cleanup remain. Gmail, OTP, passwords, magic links, transactional outbox, legacy Venmo import/backfill and stale-client rejection, physical High-Value fields, and separate unreleased SMS work remain intentionally preserved. The rendered account page was checked: **Payment information** accepts flexible arrangements, and existing data remains intact.

Remaining debt: consolidate the separate root/release trees through a dedicated tested rollout; decide legacy physical-column removal only after backup/data audit; build reviewed deletion tooling and provider-retention inventory; consider append-only acceptance history if required; upgrade minimal ESLint/Next integration and deprecated Prisma package.json configuration. This JavaScript repository has no independent TypeScript project or strict tsc check.

## Validation and delivery status

- ESLint passed; 23 unit tests passed.
- Prisma validate/generate and local migration deploy passed.
- Full marketplace integration passed: upload/access control, lifecycle, concurrency, reminders, ratings/reports, auth, cancellation/expiry, CSRF, rate limits and logout.
- Legal integration passed: new/existing account gates, current-version checkbox enforcement, timestamps, reacceptance, stale-value rejection, missing and zero snapshots.
- Password, OTP, activity and 30-day session integration suites passed.
- Next production build passed, including its lint/type-validity stage. Existing Next ESLint-plugin warning remains; this is not strict TypeScript verification.
- Compiled production runtime check passed: no unresolved placeholders in legal HTML, draft acceptance returns 503, and Vercel configuration rejects unapproved publication.
- Browser checks in both themes at 360×800, 768×1024, and 1440×1000: landing, marketplace/admin layouts and theme switching. Halloween authentication/code entry, empty state, payment label and admin tables checked. Classic has zero `.halloween-decor` nodes. No application console errors observed; checked page widths match viewport widths. Listing image filters are `none`; disposable fixtures used the logo, not student photos.
- Reduced-motion handling is verified in CSS, not through OS emulation. No claim of live-deployment QA: production is unchanged.
- Local test fixtures were removed. No remote is configured; no push was attempted.

Screenshots: `../../artifacts/halloween-v2-desktop.png` and `../../artifacts/halloween-v2-mobile-auth.png`. A compiled, email-disabled local preview is available at http://127.0.0.1:3005 while the preview process runs.

## Files changed in this continuation

- `app/accept-terms/page.js`
- `app/api/[...path]/route.js`
- `app/layout.js`
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
- `deploy/HALLOWEEN-LEGAL-REVIEW.md`
- `lib/contact.mjs`
- `lib/legal-config.mjs`
- `lib/legal.mjs`
- `lib/notification-mail.mjs`
- `lib/replacement-value.mjs`
- `next.config.mjs`
- `prisma/migrations/20261015012000_nullable_replacement_value/migration.sql`
- `prisma/schema.prisma`
- `scripts/check-production.mjs`
- `tests/integration.mjs`
- `tests/legal-integration.mjs`
- `tests/legal.test.mjs`
- `tests/replacement-value.test.mjs`
