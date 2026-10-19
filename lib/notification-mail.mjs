import { CONTACT_EMAIL } from "./contact.mjs";
export const CONTACT_NOTE = `Add ${CONTACT_EMAIL} to your contacts so Toga emails reach your inbox.`;
const clean = (value) =>
  String(value || "item")
    .replace(/https?:\/\/\S+|www\.\S+/gi, "")
    .replace(/[\r\n!]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
export function notificationMail({
  kind,
  name,
  title,
  status,
  recipientRole,
  startDate,
  endDate,
}) {
  const item = clean(title);
  let subject, detail;
  if (kind === "request") {
    subject = `${clean(name)} requested ${item} on Toga`;
    detail = `${clean(name)} requested to rent your ${item}.`;
  } else if (kind === "status") {
    subject = `${item}: rental ${clean(status).toLowerCase()} on Toga`;
    detail = `Your rental request for ${item} is ${clean(status).toLowerCase()}.`;
    if (status === "Confirmed" && recipientRole) {
      detail = `Your rental of ${item} with ${clean(name || (recipientRole === "renter" ? "the lender" : "the renter"))} is confirmed. Text them to coordinate ${recipientRole === "renter" ? "pickup and payment" : "pickup"}. Contact details are in My Rentals.${recipientRole === "renter" ? " Payment happens directly with the lender; Toga does not process payment." : ""}`;
    }
  } else {
    const action = kind === "pickup" ? "pickup" : "return";
    subject = `${item}: ${action} reminder on Toga`;
    detail = `This is a reminder about the ${action} of ${item}.`;
  }
  if (startDate && endDate)
    detail += ` Rental dates: ${new Date(startDate).toISOString().slice(0, 10)}–${new Date(endDate).toISOString().slice(0, 10)} (pickup and return included).`;
  return {
    subject,
    text: `Toga\n\n${detail}\n\nOpen Toga and go to My Rentals to view details or respond.\n\n${process.env.EMAIL_PROVIDER === "resend" ? `${process.env.APP_URL || "https://jointoga.com"}/?view=rentals` : CONTACT_NOTE}`,
  };
}
