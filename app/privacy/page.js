import LegalDocument from "../../components/legal-document";
import { PRIVACY_VERSION } from "../../lib/legal.mjs";
import { CONTACT_EMAIL, LEGAL_OPERATOR } from "../../lib/legal-config.mjs";
export default function Privacy() {
  return (
    <LegalDocument title="Privacy Policy" version={PRIVACY_VERSION}>
      <section>
        <h2>Information we collect</h2>
        <p>
          The individual operator of Toga, {LEGAL_OPERATOR}, collects your
          email, name, phone number, optional class year and profile photo,
          payment instructions you choose to share, listings and photos, rental
          requests and dates, ratings, condition photos, problem reports, and
          communications you send to support. The current app has no private
          chat feature; communications submitted in reports and support messages
          may be retained. We also store password hashes when you set a
          password, verification records, session identifiers, legal acceptance
          records, and operational delivery and security logs. Do not put bank
          credentials or other sensitive secrets in payment instructions.
        </p>
      </section>
      <section>
        <h2>How information is used and shared</h2>
        <p>
          We use this information to authenticate accounts, operate listings and
          rentals, deliver notifications, support disputes and safety reports,
          prevent abuse, and maintain the service. Listings, listing photos, and
          basic lender profiles are visible to marketplace users. Names and
          phone numbers are shared with confirmed rental partners; payment
          instructions are shared where needed to arrange payment.
          Administrators can review accounts, listings, rentals, reports, and
          notification metadata. We do not sell your personal data.
        </p>
      </section>
      <section>
        <h2>Service providers</h2>
        <p>
          Supabase provides hosted Postgres and image storage; Vercel hosts the
          application. Google/Gmail currently sends authentication and rental
          emails. SendGrid was previously used for email delivery and may retain
          historical delivery records under its own policies. SMS verification
          and notifications are not active in this pilot. Profile phone numbers
          are user-provided, not independently verified. Google Fonts serves the
          interface fonts. These providers process relevant data to provide
          their services and may process it outside your state or country.
        </p>
      </section>
      <section>
        <h2>Cookies, storage, and photos</h2>
        <p>
          A secure, HTTP-only session cookie keeps you signed in for
          approximately 30 days and renews during use. Logging out invalidates
          the session. Browser storage remembers saved listing IDs and pending
          verification state. Uploaded images are stored in a private Supabase
          bucket and served through authenticated app routes. Listing images are
          visible to marketplace users, while condition and report photos have
          additional access checks. Recipients can still copy images they are
          permitted to view, so avoid uploading private documents or unnecessary
          personal information.
        </p>
      </section>
      <section>
        <h2>Retention and deletion</h2>
        <p>
          We retain account and marketplace records while needed to operate the
          service, handle disputes, prevent abuse, and meet legal obligations.
          When the maintenance job runs, expired sessions and sign-in tokens are
          removed, expired rate-limit records are removed, and verification-code
          records are removed once they have been expired for more than one day.
          Stored sign-in-link emails older than 15 minutes are removed. These
          are job-based cleanups, not exact-time deletion guarantees.
          Authentication email content is omitted from stored email records.
          Other operational records and images currently require reviewed
          deletion; we do not promise automatic deletion after a fixed period.
          Account, payment-instruction, listing, rental, rating, report,
          notification, and legal-acceptance records have no automatic age-based
          deletion today. Deletion requests are reviewed by the operator,
          including associated images and any need to preserve dispute or
          security records. Backups and provider records may persist under
          provider policies; immediate removal from every backup is not
          promised. Legal requirements or unresolved disputes may require
          limited retention after an account closes.
        </p>
      </section>
      <section id="contact">
        <h2>Your choices and contact</h2>
        <p>
          Request access, correction, or deletion by emailing {CONTACT_EMAIL}.
          We may ask you to verify account ownership before acting. You can edit
          your profile and remove available listings through Toga. Deleting an
          account may affect ongoing rentals; we will explain any information
          that must be retained. Questions about this policy or privacy
          practices should also go to {CONTACT_EMAIL}.
        </p>
      </section>
      <section>
        <h2>Eligibility and changes</h2>
        <p>
          Toga is for adults aged 18 or older. We do not intend to collect
          information from minors; contact us if a minor has provided
          information. Updated policies carry a new version number and require
          renewed acceptance in the app.
        </p>
      </section>
    </LegalDocument>
  );
}
