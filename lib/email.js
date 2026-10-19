import { isAuthEmail } from "./email-status.mjs";
import { authLog } from "./auth-log.mjs";
import { db } from "./db.js";
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
  if (isAuthEmail(record.subject) && result.deliveryStatus === "Retry")
    result.deliveryStatus = "Failed";
  authLog("email_send_finished", {
    messageId: record.id,
    providerMessageId: result.providerMessageId,
    status: result.deliveryStatus,
    reason: result.error,
  });
  // If the process dies after sending, the stale claim becomes Unknown, never an automatic resend.
  return db.email.update({ where: { id: record.id }, data: result });
}
export async function sendEmail(to, subject, text, { id } = {}) {
  const sensitive =
    subject === "Your Toga verification code" ||
    subject === "Your Toga sign-in link";
  const record = await db.email.create({
    data: {
      ...(id ? { id } : {}),
      to,
      subject,
      text: sensitive ? "Authentication content omitted." : text,
    },
  });
  return deliverEmail({ ...record, text });
}

export async function queuedNotifications(store = db) {
  const eligible = {
    sentAt: null,
    deliveryStatus: { in: ["Queued", "Retry"] },
    attempts: { lt: 5 },
    createdAt: { gt: new Date(Date.now() - 23 * 3600000) },
    NOT: {
      subject: {
        in: ["Your Toga sign-in link", "Your Toga verification code"],
      },
    },
  };
  const monitoring = [
    "Toga Admin — New user signup",
    "Toga Admin — User signed in",
  ];
  // Separate bounded queries prevent an older monitoring backlog from hiding user mail.
  const tiers = [
    {
      NOT: {
        OR: [
          { subject: { startsWith: "Toga Admin" } },
          { id: { startsWith: "reminder-" } },
        ],
      },
    },
    { id: { startsWith: "reminder-" } },
    {
      subject: { startsWith: "Toga Admin" },
      NOT: { subject: { in: monitoring } },
    },
    { subject: { in: monitoring } },
  ];
  const batches = await Promise.all(
    tiers.map((tier) =>
      store.email.findMany({
        where: { AND: [eligible, tier] },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 50,
      }),
    ),
  );
  return batches.flat().slice(0, 50);
}
