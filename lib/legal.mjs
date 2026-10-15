export const TERMS_VERSION = "2026-10-15-v2";
export const PRIVACY_VERSION = "2026-10-15-v2";
export const ACCEPTANCE =
  "I am 18 or older, I have read and agree to the Terms of Service and Privacy Policy, and I understand Toga is a platform and not a party to rentals";
export const LENDER_CONFIRMATION =
  "I own this item, my description is accurate, I've disclosed any known hazards, and it's clean. I won't list prohibited items (weapons or realistic weapon props, flammable or hazardous items).";
export function needsAcceptance(user) {
  return Boolean(
    user &&
    (!user.termsAcceptedAt ||
      !user.ageConfirmedAt ||
      user.termsVersion !== TERMS_VERSION ||
      user.privacyVersion !== PRIVACY_VERSION),
  );
}
export function renterAcknowledgement(value) {
  if (value == null)
    return "Replacement value: Not specified. I'm responsible for returning this item in the same condition. Any loss or damage must be resolved directly with the lender; no fixed replacement amount has been agreed here. Toga is a platform and not a party to this rental.";
  return `I'm responsible for returning this item in the same condition, or paying the replacement value of $${Number(value).toFixed(2)} if it's lost or damaged. Toga is a platform and not a party to this rental.`;
}
