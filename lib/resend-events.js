import { db } from "./db.js";
export const eventStatus = {
  "email.delivered": "Delivered",
  "email.bounced": "Bounced",
  "email.complained": "Complained",
  "email.failed": "Failed",
  "email.suppressed": "Failed",
};
// Terminal negative outcomes must never be overwritten by a delayed delivered event.
export function mayApplyStatus(current, next) {
  if (current === "Complained") return false;
  if (current === "Bounced") return next === "Complained";
  if (current === "Failed") return ["Bounced", "Complained"].includes(next);
  return true;
}
export async function reconcileResendEvents(messageId, store = db) {
  const events = await store.emailDeliveryEvent.findMany({
    where: { providerMessageId: messageId },
    orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
  });
  for (const event of events) {
    const next = eventStatus[event.type];
    if (!next) continue;
    const records = await store.email.findMany({
      where: { provider: "resend", providerMessageId: messageId },
    });
    for (const record of records) {
      if (!mayApplyStatus(record.deliveryStatus, next)) continue;
      await store.email.updateMany({
        where: { id: record.id, deliveryStatus: record.deliveryStatus },
        data: {
          deliveryStatus: next,
          providerEventAt: event.occurredAt,
          ...(next === "Delivered"
            ? { deliveredAt: event.occurredAt, error: null }
            : {
                error: `Resend reported ${event.type}. See provider dashboard for details.`,
              }),
        },
      });
    }
  }
}
