import { db } from "./db";
import { deliverEmail } from "./email";
export async function expireRequests() {
  const expired = await db.rentalRequest.findMany({
    where: {
      status: "Pending",
      createdAt: { lt: new Date(Date.now() - 48 * 3600000) },
    },
  });
  for (const request of expired)
    await db.$transaction(async (tx) => {
      const changed = await tx.rentalRequest.updateMany({
        where: { id: request.id, status: "Pending" },
        data: { status: "Expired" },
      });
      if (changed.count)
        await tx.listing.update({
          where: { id: request.listingId },
          data: { status: "Active" },
        });
    });
  return expired.length;
}
export async function runJobs() {
  const expired = await expireRequests();
  const rentals = await db.rentalRequest.findMany({
    where: { status: { in: ["Confirmed", "Active Rental"] } },
    include: { listing: true },
  });
  for (const rental of rentals) {
    const pickup =
      rental.status === "Confirmed" &&
      !rental.pickupReminderSent &&
      +rental.startDate <= Date.now() + 86400000;
    const returning =
      rental.status === "Active Rental" &&
      !rental.returnReminderSent &&
      +rental.endDate <= Date.now() + 86400000;
    if (!pickup && !returning) continue;
    // Queue and claim the reminder in the same transaction. Concurrent jobs cannot duplicate it.
    await db.$transaction(async (tx) => {
      const flag = pickup ? "pickupReminderSent" : "returnReminderSent";
      const claimed = await tx.rentalRequest.updateMany({
        where: { id: rental.id, status: rental.status, [flag]: false },
        data: { [flag]: true },
      });
      if (!claimed.count) return;
      const people = await tx.user.findMany({
        where: { id: { in: [rental.renterId, rental.lenderId] } },
      });
      for (const person of people)
        await tx.email.create({
          data: {
            id: `reminder-${rental.id}-${flag}-${person.id}`,
            to: person.email,
            subject: `${pickup ? "Pickup" : "Return"} reminder · Toga`,
            text: `${rental.listing.title} is due for ${pickup ? "pickup" : "return"}. Coordinate with your rental partner: ${process.env.APP_URL}/?view=rentals`,
          },
        });
    });
  }
  await db.email.updateMany({
    where: {
      deliveryStatus: "Sending",
      claimedAt: { lt: new Date(Date.now() - 120000) },
    },
    data: {
      deliveryStatus: "Unknown",
      error:
        "Delivery interrupted. Check SendGrid Email Activity before resending.",
    },
  });
  if (process.env.SENDGRID_API_KEY) {
    const queue = await db.email.findMany({
      where: {
        sentAt: null,
        deliveryStatus: { in: ["Queued", "Retry"] },
        attempts: { lt: 5 },
        createdAt: { gt: new Date(Date.now() - 23 * 3600000) },
        NOT: {
          subject: {
            in: ["Your Toga sign-in link", "Your Toga verification code"],
          },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 50,
    });
    const deadline = Date.now() + 40000;
    for (const email of queue) {
      if (Date.now() > deadline) break;
      await deliverEmail(email);
    }
  }
  await db.emailOtp.deleteMany({
    where: { expiresAt: { lt: new Date(Date.now() - 86400000) } },
  });
  await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await db.loginToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await db.rateLimit.deleteMany({ where: { resetsAt: { lt: new Date() } } });
  // Magic-link content is sensitive and has no value once the token expires.
  await db.email.deleteMany({
    where: {
      subject: "Your Toga sign-in link",
      createdAt: { lt: new Date(Date.now() - 15 * 60000) },
    },
  });
  return { expired };
}
