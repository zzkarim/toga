import { authLog } from "./auth-log.mjs";
import { db } from "./db";
import { sendMailMessage, emailConfigured } from "./mail-provider.mjs";
export async function deliverEmail(record) {
  if (!emailConfigured()) return record;
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
  authLog("email_send_started", { messageId: record.id });
  const result = await sendMailMessage(record);
  authLog("email_send_finished", {
    messageId: record.id,
    providerMessageId: result.providerMessageId,
    status: result.deliveryStatus,
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
