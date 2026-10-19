import { displayPhone, normalizePhone } from "../lib/profile.mjs";
export default function RentalCoordination({ rental }) {
  if (!["Confirmed", "Active Rental", "Completed"].includes(rental.status))
    return null;
  const { partner, viewerRole, status } = rental;
  const renter = viewerRole === "renter",
    phone = normalizePhone(partner.phone);
  const name = partner.name?.trim() || (renter ? "your lender" : "your renter");
  const action =
    status === "Confirmed"
      ? renter
        ? "pickup and payment"
        : "pickup"
      : status === "Active Rental"
        ? "return"
        : "any rental follow-up";
  return (
    <section
      className="contact-details rental-coordination"
      aria-label="Rental partner"
    >
      <strong>
        Text {name} to coordinate {action}.
      </strong>
      {phone ? (
        <>
          <a className="button burgundy text-partner" href={`sms:${phone}`}>
            Text {name}
          </a>
          <a className="partner-phone" href={`tel:${phone}`}>
            {name} · {displayPhone(phone)}
          </a>
        </>
      ) : (
        <p>
          {name} hasn’t provided a valid phone number. Contact Toga for help
          coordinating.
        </p>
      )}
      {renter && partner.paymentInfo && (
        <div className="payment-info">
          <strong>Payment information</strong>
          <div>{partner.paymentInfo}</div>
        </div>
      )}
      <small>
        {renter
          ? "Payment happens directly between you and the lender. Toga does not process payment."
          : "Coordinate the clothing exchange directly with the renter."}
      </small>
    </section>
  );
}
