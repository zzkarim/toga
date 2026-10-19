import { Webhook } from "svix";
import { db } from "../../../../lib/db.js";
import {
  eventStatus,
  reconcileResendEvents,
} from "../../../../lib/resend-events.js";
export const runtime = "nodejs";
export async function POST(req) {
  if (!process.env.RESEND_WEBHOOK_SECRET)
    return new Response("Unavailable", { status: 503 });
  const raw = await req.text();
  if (raw.length > 65536) return new Response("Too large", { status: 413 });
  let event;
  const id = req.headers.get("svix-id");
  try {
    new Webhook(process.env.RESEND_WEBHOOK_SECRET).verify(raw, {
      "svix-id": id,
      "svix-timestamp": req.headers.get("svix-timestamp"),
      "svix-signature": req.headers.get("svix-signature"),
    });
    event = JSON.parse(raw);
    if (!eventStatus[event.type]) return Response.json({ ok: true });
    if (
      typeof event.data?.email_id !== "string" ||
      !Number.isFinite(Date.parse(event.created_at))
    )
      throw Error();
  } catch {
    return new Response("Invalid webhook", { status: 400 });
  }
  await db.emailDeliveryEvent.upsert({
    where: { id },
    update: {},
    create: {
      id,
      providerMessageId: event.data.email_id,
      type: event.type,
      occurredAt: new Date(event.created_at),
    },
  });
  await reconcileResendEvents(event.data.email_id);
  return Response.json({ ok: true });
}
