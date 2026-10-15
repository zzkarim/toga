import LegalDocument from "../../components/legal-document";
import { TERMS_VERSION } from "../../lib/legal.mjs";
// TODO before publication: [ENTITY NAME], [CONTACT EMAIL], [GOVERNING STATE],
// [DISPUTE RESOLUTION], [DMCA AGENT NAME / ADDRESS / PHONE / EMAIL]. Attorney review required.
export default function Terms() {
  return (
    <LegalDocument title="Terms of Service" version={TERMS_VERSION}>
      <section>
        <h2>1. Who operates Toga</h2>
        <p>
          Toga is operated by [ENTITY NAME]. Toga connects students who want to
          lend or rent clothing. Toga is a platform, not the owner, lender,
          renter, agent, or insurer of any item, and is not a party to any
          rental. Each rental is an agreement between its lender and renter.
          Toga is not affiliated with or endorsed by Georgia Tech or any
          university.
        </p>
      </section>
      <section>
        <h2>2. Eligibility and accounts</h2>
        <p>
          You must be at least 18, a current student with a valid .edu email,
          and maintain only one account per person. The current pilot accepts
          @gatech.edu addresses. An expressly authorized administrator account
          may use its designated non-campus address to operate the platform.
          Keep account credentials secure and provide accurate information. An
          email address or account does not establish that a person or item has
          been independently verified.
        </p>
      </section>
      <section>
        <h2>3. Listings and lender responsibilities</h2>
        <p>
          You must own each item you list and have the right to lend it.
          Describe its condition, size, price, and replacement value accurately,
          disclose all known defects and hazards, and clean the item before
          lending it. Do not list weapons or realistic weapon props, flammable
          or hazardous items, stolen or counterfeit goods, or items requiring a
          license. Do not post content that infringes another person's rights.
        </p>
      </section>
      <section>
        <h2>4. Renter responsibilities</h2>
        <p>
          Inspect the item before taking possession. Return it on the agreed
          date in the same condition. By requesting a rental, you agree with the
          lender to pay the listed replacement value if the item is lost or
          damaged, subject to applicable law and any resolution agreed between
          you. Review that value before requesting. Toga does not assess,
          collect, or guarantee this payment. Photograph condition at pickup and
          return and report problems promptly.
        </p>
      </section>
      <section>
        <h2>5. Payments and arrangements</h2>
        <p>
          Payments, pickup, return, and any permitted changes are arranged
          directly between users. Toga does not process, hold, or guarantee
          money and does not provide deposits or insurance. Confirm costs and
          payment arrangements with your rental partner.
        </p>
      </section>
      <section>
        <h2>6. No guarantees</h2>
        <p>
          Items are offered “as is” and “as available.” Toga does not verify or
          guarantee users, ownership, listings, availability, condition, sizing,
          cleanliness, hygiene, safety, or fitness for a purpose. To the extent
          permitted by law, Toga disclaims warranties and liability for
          non-delivery, non-return, damage, loss, injury, and disputes arising
          from rentals. These provisions do not exclude rights or liabilities
          that applicable law does not allow us to exclude.
        </p>
      </section>
      <section>
        <h2>7. Reports, mediation, and moderation</h2>
        <p>
          Contact the founder through [CONTACT EMAIL] as the first step in a
          rental dispute. Provide a factual description and relevant photos.
          Toga offers good-faith mediation only, has no authority to bind either
          user to a settlement, and guarantees no outcome. You may seek urgent
          assistance or exercise non-waivable legal rights without waiting for
          mediation. Toga may remove listings, restrict accounts, or remove
          users at its discretion, subject to applicable law.
        </p>
      </section>
      <section>
        <h2>8. Liability and indemnification</h2>
        <p>
          To the fullest extent permitted by law, [ENTITY NAME] and its
          personnel are not liable for indirect, incidental, consequential, or
          special losses arising from use of Toga or user-to-user rentals. You
          agree, to the extent permitted by law, to indemnify [ENTITY NAME] and
          its personnel against third-party claims, damages, and reasonable
          costs arising from your unlawful conduct, infringement, misleading
          listings, or breach of these terms. This does not require
          indemnification for conduct or liability that cannot legally be
          shifted to you. The scope and enforceability of these provisions
          remain subject to attorney review.
        </p>
      </section>
      <section>
        <h2>9. Copyright notices</h2>
        <p>
          Send copyright complaints identifying the protected work, the
          allegedly infringing content and its location, your contact
          information, signature, and the required good-faith and accuracy
          statements to [DMCA AGENT NAME / ADDRESS / PHONE / EMAIL]. Contact
          [CONTACT EMAIL] for questions. Toga may remove infringing content and
          terminate repeat infringers in appropriate circumstances. Agent
          designation, registration, counter-notice procedures, and final
          takedown policy are pending attorney review; this draft does not claim
          DMCA safe-harbor qualification.
        </p>
      </section>
      <section>
        <h2>10. Governing law and disputes</h2>
        <p>
          Governing law: [GOVERNING STATE], subject to mandatory applicable law.
          Dispute-resolution procedure and forum: [DISPUTE RESOLUTION]. These
          placeholders do not establish an arbitration requirement or waive a
          right to court proceedings.
        </p>
      </section>
      <section>
        <h2>11. Updates and contact</h2>
        <p>
          We may update these terms with a new version number. Toga will require
          acceptance of the current version before continued marketplace use.
          Changes do not retroactively replace recorded rental acknowledgements.
          Questions: [CONTACT EMAIL].
        </p>
      </section>
    </LegalDocument>
  );
}
