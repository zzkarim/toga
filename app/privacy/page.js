import LegalDocument from "../../components/legal-document";
import { PRIVACY_VERSION } from "../../lib/legal.mjs";
// TODO before publication: [ENTITY NAME], [CONTACT EMAIL], [RETENTION SCHEDULE].
export default function Privacy() {
  return (
    <LegalDocument title="Privacy Policy" version={PRIVACY_VERSION}>
      <section>
        <h2>Information we collect</h2>
        <p>
          [ENTITY NAME] collects your email, name, phone number, optional class
          year and profile photo, payment instructions you choose to share,
          listings and photos, rental requests and dates, ratings, condition
          photos, problem reports, and communications you send to support. The
          current app has no private chat feature; communications submitted in
          reports and support messages may be retained. We also store password
          hashes when you set a password, verification records, session
          identifiers, legal acceptance records, and operational delivery and
          security logs. Do not put bank credentials or other sensitive secrets
          in payment instructions.
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
          historical delivery records under its own policies. The unreleased SMS
          implementation is not active in this pilot; if enabled, Twilio would
          process phone verification and SMS notifications under a separately
          disclosed consent flow. Google Fonts serves the interface fonts. These
          providers process relevant data to provide their services and may
          process it outside your state or country.
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
          Expired verification and session records are periodically removed.
          Authentication email content is omitted from stored email records.
          Other operational records and images currently require reviewed
          deletion; we do not promise automatic deletion after a fixed period. A
          detailed [RETENTION SCHEDULE], including backups and provider
          retention, must be finalized before publication. Legal requirements or
          unresolved disputes may require limited retention after an account
          closes.
        </p>
      </section>
      <section id="contact">
        <h2>Your choices and contact</h2>
        <p>
          Request access, correction, or deletion by emailing [CONTACT EMAIL].
          We may ask you to verify account ownership before acting. You can edit
          your profile and remove available listings through Toga. Deleting an
          account may affect ongoing rentals; we will explain any information
          that must be retained. Questions about this policy or privacy
          practices should also go to [CONTACT EMAIL].
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
