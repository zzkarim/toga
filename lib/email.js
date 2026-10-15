import { db } from "./db";
import { sendThroughSendGrid } from "./sendgrid.mjs";
export async function deliverEmail(record) {
  if (!process.env.SENDGRID_API_KEY) return record;
  const claimed = await db.email.updateMany({
    where: {
      id: record.id,
      sentAt: null,
      deliveryStatus: { in: ["Queued", "Retry"] },
      attempts: { lt: 5 },
    },
    data: {
      deliveryStatus: "Sending",
      claimedAt: new Date(),
      attempts: { increment: 1 },
    },
  });
  if (!claimed.count) return db.email.findUnique({ where: { id: record.id } });
  const result = await sendThroughSendGrid(record, {
    key: process.env.SENDGRID_API_KEY,
    sender: process.env.EMAIL_FROM,
  });
  // If the process dies after sending, the stale claim becomes Unknown, never an automatic resend.
  return db.email.update({ where: { id: record.id }, data: result });
}
export async function sendEmail(to, subject, text) {
  const sensitive =
    subject === "Your Toga verification code" ||
    subject === "Your Toga sign-in link";
  const record = await db.email.create({
    data: {
      to,
      subject,
      text: sensitive ? "Authentication content omitted." : text,
    },
  });
  return deliverEmail({ ...record, text });
}
