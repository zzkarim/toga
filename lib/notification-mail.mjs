import { CONTACT_EMAIL } from "./contact.mjs";
export const CONTACT_NOTE = `Add ${CONTACT_EMAIL} to your contacts so Toga emails reach your inbox.`;
const clean = (value) =>
  String(value || "item")
    .replace(/https?:\/\/\S+|www\.\S+/gi, "")
    .replace(/[\r\n!]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
export function notificationMail({ kind, name, title, status }) {
  const item = clean(title);
  let subject, detail;
  if (kind === "request") {
    subject = `${clean(name)} requested ${item} on Toga`;
    detail = `${clean(name)} requested to rent your ${item}.`;
  } else if (kind === "status") {
    subject = `${item}: rental ${clean(status).toLowerCase()} on Toga`;
    detail = `Your rental request for ${item} is ${clean(status).toLowerCase()}.`;
  } else {
    const action = kind === "pickup" ? "pickup" : "return";
    subject = `${item}: ${action} reminder on Toga`;
    detail = `This is a reminder about the ${action} of ${item}.`;
  }
  return {
    subject,
    text: `Toga\n\n${detail}\n\nOpen Toga and go to My Rentals to view details or respond.\n\n${CONTACT_NOTE}`,
  };
}
