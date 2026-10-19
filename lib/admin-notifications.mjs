import { ADMIN_EXCEPTION_EMAIL } from "./campus.mjs";
import { sendEmail } from "./email.js";

export const ADMIN_NOTIFICATION_EMAIL = ADMIN_EXCEPTION_EMAIL;

const formatUser = (name, email) => {
  const safeName = String(name || "").trim();
  const safeEmail = String(email || "").trim();
  if (safeName && safeEmail) return `${safeName} (${safeEmail})`;
  if (safeName) return safeName;
  return safeEmail || "Unknown user";
};

const formatDate = (value) =>
  value ? new Date(value).toISOString().slice(0, 10) : "unknown";

export function buildAdminMarketplaceEmail(details = {}) {
  const {
    event,
    rentalId,
    reportId,
    listingName,
    renterName,
    renterEmail,
    lenderName,
    lenderEmail,
    reporterName,
    reporterEmail,
    actorName,
    actorEmail,
    otherName,
    otherEmail,
    startDate,
    endDate,
    status,
    createdAt,
    reason,
    description,
  } = details;
  const timestamp = createdAt
    ? new Date(createdAt).toISOString()
    : new Date().toISOString();
  const listing = String(listingName || "unknown item").trim();
  const renter = formatUser(renterName, renterEmail);
  const lender = formatUser(lenderName, lenderEmail);
  const actor = formatUser(actorName, actorEmail);
  const dates = `${formatDate(startDate)} to ${formatDate(endDate)}`;
  const lines = [`Timestamp: ${timestamp}`];
  const subjects = {
    request: "Toga Admin — New rental request",
    accept: "Toga Admin — Rental accepted",
    decline: "Toga Admin — Rental declined",
    pickup: "Toga Admin — Item picked up",
    return: "Toga Admin — Item returned",
    cancel: "Toga Admin — Rental cancelled",
    expired: "Toga Admin — Rental expired",
    report: "Toga Admin — Problem reported",
  };

  if (event === "request") {
    lines.unshift(
      `New rental request for ${listing}.`,
      `Renter: ${renter}`,
      `Lender: ${lender}`,
      `Rental dates: ${dates}`,
      `Request ID: ${rentalId || "unknown"}`,
      `Status: ${status || "Pending"}`,
    );
  } else if (event === "accept" || event === "decline") {
    lines.unshift(
      `${lender} ${event === "accept" ? "accepted" : "declined"} ${renter}'s request for ${listing}.`,
      `Rental dates: ${dates}`,
      `Rental ID: ${rentalId || "unknown"}`,
      `Status: ${status || (event === "accept" ? "Confirmed" : "Declined")}`,
    );
  } else if (event === "pickup" || event === "return") {
    lines.unshift(
      `${renter} marked ${listing} ${event === "pickup" ? "picked up from" : "returned to"} ${lender}.`,
      `Rental dates: ${dates}`,
      `Rental ID: ${rentalId || "unknown"}`,
      `Status: ${status || (event === "pickup" ? "Active Rental" : "Completed")}`,
    );
  } else if (event === "cancel") {
    lines.unshift(
      `${actor} cancelled the rental for ${listing}.`,
      `Renter: ${renter}`,
      `Lender: ${lender}`,
      `Rental dates: ${dates}`,
      `Rental ID: ${rentalId || "unknown"}`,
      `Status: ${status || "Cancelled"}`,
      `Reason: ${reason || "No reason provided"}`,
    );
  } else if (event === "expired") {
    lines.unshift(
      `A rental request for ${listing} expired without a response.`,
      `Renter: ${renter}`,
      `Lender: ${lender}`,
      `Rental dates: ${dates}`,
      `Rental ID: ${rentalId || "unknown"}`,
      `Status: ${status || "Expired"}`,
    );
  } else if (event === "report") {
    lines.unshift(
      `Problem report submitted by ${formatUser(reporterName, reporterEmail)}.`,
      `Report ID: ${reportId || "unknown"}`,
      `Report category: ${String(details.reportCategory || "Rental problem")}`,
      `Rental ID: ${rentalId || "unknown"}`,
      `Listing: ${listing}`,
      `Other party: ${formatUser(otherName, otherEmail)}`,
      `Description: ${String(description || "No description provided").slice(0, 3000)}`,
    );
  } else {
    lines.unshift(`Marketplace event: ${String(event || "unknown")}`);
  }

  if (details.renterPhone || details.lenderPhone || event === "accept") {
    lines.push(
      `Renter phone: ${details.renterPhone || "Not provided"}`,
      `Lender phone: ${details.lenderPhone || "Not provided"}`,
    );
    if (details.paymentInfo)
      lines.push(`Lender payment information: ${details.paymentInfo}`);
  }
  return {
    subject: subjects[event] || "Toga Admin — Marketplace event",
    text: `Toga admin notification\n\n${lines.join("\n\n")}\n\nToga Admin Copy`,
  };
}

export async function notifyAdminOfMarketplaceEvent(details, send = sendEmail) {
  if (!details?.event) return false;
  const eventId = details.reportId
    ? `report-${details.reportId}`
    : details.rentalId
      ? `${details.event}-${details.rentalId}`
      : null;
  if (!eventId) return false;
  const email = buildAdminMarketplaceEmail(details);
  try {
    const result = await send(
      ADMIN_NOTIFICATION_EMAIL,
      email.subject,
      email.text,
      {
        id: `admin-${eventId}`,
      },
    );
    if (result?.deliveryStatus && result.deliveryStatus !== "Accepted") {
      console.warn("Admin marketplace email remains in the outbox", {
        event: details.event,
        status: result.deliveryStatus,
      });
      return false;
    }
    return true;
  } catch (error) {
    console.error("Admin marketplace notification failed", {
      event: details.event,
      reason:
        error?.code === "P2002"
          ? "event_already_queued"
          : "outbox_or_provider_error",
    });
    return false;
  }
}

export function buildAdminAuthEmail({ event, user, occurredAt }) {
  if (!["signup", "login"].includes(event))
    throw new Error("Unsupported authentication event");
  return {
    subject:
      event === "signup"
        ? "Toga Admin — New user signup"
        : "Toga Admin — User signed in",
    text: `Toga admin notification\n\nEmail: ${user.email}\n${user.name ? `Name: ${user.name}\n` : ""}Timestamp: ${new Date(occurredAt).toISOString()}\n\nToga Admin Copy`,
  };
}
export async function notifyAdminOfAuthEvent(details, send = sendEmail) {
  try {
    const message = buildAdminAuthEmail(details);
    const id =
      details.event === "signup"
        ? `admin-signup-${details.user.id}`
        : `admin-login-${details.eventId}`;
    if (details.event === "login" && !details.eventId) return false;
    const result = await send(
      ADMIN_NOTIFICATION_EMAIL,
      message.subject,
      message.text,
      { id },
    );
    return result?.deliveryStatus === "Accepted";
  } catch {
    console.warn("Admin authentication notification failed");
    return false;
  }
}
