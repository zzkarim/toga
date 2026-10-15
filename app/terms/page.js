import LegalDocument from "../../components/legal-document";
import { TERMS_VERSION } from "../../lib/legal.mjs";
import {
  CONTACT_EMAIL,
  LEGAL_OPERATOR,
  GOVERNING_JURISDICTION,
} from "../../lib/legal-config.mjs";
export default function Terms() {
  return (
    <LegalDocument title="Terms of Service" version={TERMS_VERSION}>
      <section>
        <h2>1. Who operates Toga</h2>
        <p>
          Toga is an individually operated, unincorporated service operating
          under the name Toga.{" "}
          {LEGAL_OPERATOR ? (
            <>Its operator is {LEGAL_OPERATOR}.</>
          ) : (
            <>
              The operator’s legal identification has not yet been finalized for
              these draft documents; contact {CONTACT_EMAIL} with questions.
            </>
          )}{" "}
          Toga is a product name, not an LLC or corporation. Toga connects
          students who want to lend or rent clothing. Toga is a platform, not
          the owner, lender, renter, agent, or insurer of any item, and is not a
          party to any rental. Each rental is an agreement between its lender
          and renter. Toga is not affiliated with or endorsed by Georgia Tech or
          any university.
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
          lender to pay a specified replacement value if the item is lost or
          damaged, subject to applicable law and any resolution agreed between
          you. A blank replacement value means Not specified, not zero; no fixed
          replacement amount is agreed by that request. Discuss loss or damage
          directly with your rental partner. Review any specified value before
          requesting. Toga does not assess, collect, or guarantee this payment.
          Photograph condition at pickup and return and report problems
          promptly.
        </p>
      </section>
      <section>
        <h2>5. Payments and arrangements</h2>
        <p>
          Payments, pickup, return, and any permitted changes are arranged
          directly between users. Toga does not process, hold, or guarantee
          money and does not provide deposits or insurance. Confirm costs and
          payment arrangements with your rental partner. Toga does not deliver
          items, handle physical exchanges, or inspect every item.
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
          Contact the founder through {CONTACT_EMAIL} as the first step in a
          rental dispute. Provide a factual description and relevant photos.
          Toga may help users communicate in good faith, has no authority to
          bind either user to a settlement, and guarantees no outcome. You may
          seek urgent assistance or exercise non-waivable legal rights without
          waiting for mediation. Toga may remove listings, restrict accounts, or
          remove users at its discretion, subject to applicable law.
        </p>
      </section>
      <section>
        <h2>8. Liability and indemnification</h2>
        <p>
          To the fullest extent permitted by law, the individual operator of
          Toga is not liable for indirect, incidental, consequential, or special
          losses arising from use of Toga or user-to-user rentals. You agree, to
          the extent permitted by law, to indemnify the individual operator of
          Toga against third-party claims, damages, and reasonable costs arising
          from your unlawful conduct, infringement, misleading listings, or
          breach of these terms. This does not require indemnification for
          conduct or liability that cannot legally be shifted to you. The scope
          and enforceability of these provisions remain subject to attorney
          review. These contractual provisions do not create an incorporated
          entity or an entity-based limited-liability shield for the operator.
        </p>
      </section>
      <section>
        <h2>9. Copyright notices</h2>
        <p>
          Send ordinary copyright complaints to {CONTACT_EMAIL}, identifying the
          work, the listing or content location, and how to contact you. Toga
          may remove infringing content and restrict repeat infringers in
          appropriate circumstances. This contact is not represented as a
          registered DMCA agent. Toga does not claim DMCA safe-harbor
          qualification. Formal agent designation, registration, and
          notice/counter-notice procedures require separate review before any
          such claim.
        </p>
      </section>
      <section>
        <h2>10. Governing law and disputes</h2>
        <p>
          {GOVERNING_JURISDICTION ? (
            <>
              Governing law: {GOVERNING_JURISDICTION}, subject to mandatory
              applicable law.
            </>
          ) : (
            <>
              No governing jurisdiction has been selected in these draft terms.
              Applicable mandatory law still applies.
            </>
          )}{" "}
          Contact {CONTACT_EMAIL} with a factual description of a dispute and
          relevant records. We may request clarification and help the parties
          discuss a resolution, but cannot bind them to a settlement. These
          terms do not impose mandatory arbitration, a class-action or
          jury-trial waiver, or an exclusive court venue. Contacting Toga does
          not prevent you from seeking legal remedies or urgent assistance.
        </p>
      </section>
      <section>
        <h2>11. Updates and contact</h2>
        <p>
          We may update these terms with a new version number. Toga will require
          acceptance of the current version before continued marketplace use.
          Changes do not retroactively replace recorded rental acknowledgements.
          Questions: {CONTACT_EMAIL}.
        </p>
      </section>
    </LegalDocument>
  );
}
