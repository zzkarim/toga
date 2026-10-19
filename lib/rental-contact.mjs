import { normalizePhone } from "./profile.mjs";
export function rentalContact(rental, viewerId, people) {
  const renter = rental.renterId === viewerId;
  if (
    ![rental.renterId, rental.lenderId].includes(viewerId) ||
    rental.renterId === rental.lenderId
  )
    throw new Error("Rental participant mismatch");
  const partnerId = renter ? rental.lenderId : rental.renterId;
  const person = people.find((p) => p.id === partnerId);
  if (!person) throw new Error("Rental participant unavailable");
  const partner = {
    id: person.id,
    name: person.name,
    classYear: person.classYear,
    profilePhotoUrl: person.profilePhotoUrl,
  };
  if (["Confirmed", "Active Rental", "Completed"].includes(rental.status)) {
    partner.phone = normalizePhone(person.phone);
    if (renter) partner.paymentInfo = person.paymentInfo;
  }
  return { viewerRole: renter ? "renter" : "lender", partner };
}
export function rentalResponseMatches(response, viewerId) {
  return (
    response.viewerId === viewerId &&
    response.requests.every(
      (r) =>
        [r.renterId, r.lenderId].includes(viewerId) &&
        r.partner?.id !== viewerId &&
        r.partner?.id === (r.renterId === viewerId ? r.lenderId : r.renterId),
    )
  );
}
