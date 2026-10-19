import { ImapFlow } from "imapflow";
import { db } from "./db.js";
import { emailConfigured } from "./mail-provider.mjs";
import { parseGmailDsn } from "./gmail-dsn.mjs";
import { authLog } from "./auth-log.mjs";
export async function applyBounce(store, bounce) {
  return store.email.updateMany({
    where: {
      providerMessageId: bounce.providerMessageId,
      to: bounce.recipient,
      deliveryStatus: { in: ["Accepted", "Unknown"] },
    },
    data: { deliveryStatus: "Bounced", error: bounce.error },
  });
}
// Read-only, one scan per minute across instances, at most 30 recent DSNs / 12 seconds.
export async function syncGmailBounces({
  store = db,
  client,
  configured = emailConfigured(),
} = {}) {
  if (!configured) return { status: "disabled", matched: 0 };
  const now = new Date(),
    until = new Date(+now + 60000);
  const claim =
    await store.$queryRaw`INSERT INTO "toga"."RateLimit" ("id", "count", "resetsAt") VALUES ('gmail-bounce-scan', 0, ${until}) ON CONFLICT ("id") DO UPDATE SET "count"=0,"resetsAt"=${until} WHERE "RateLimit"."resetsAt" <= ${now} RETURNING "id"`;
  if (!claim.length) {
    const previous = await store.rateLimit.findUnique({
      where: { id: "gmail-bounce-scan" },
      select: { count: true },
    });
    return {
      status: previous?.count === -1 ? "unavailable" : "recently-checked",
      matched: 0,
    };
  }
  const mail =
    client ||
    new ImapFlow({
      host: "imap.gmail.com",
      port: 993,
      secure: true,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
      logger: false,
      logRaw: false,
      disableAutoIdle: true,
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000,
      maxLiteralSize: 262144,
      maxResponseSize: 524288,
    });
  mail.on?.("error", () => {});
  const timer = setTimeout(() => mail.close(), 12000);
  let lock,
    matched = 0;
  try {
    await mail.connect();
    lock = await mail.getMailboxLock("INBOX", { readOnly: true });
    const uids = await mail.search(
      {
        gmraw:
          "from:(mailer-daemon@googlemail.com OR mailer-daemon@gmail.com) newer_than:7d",
        smaller: 262144,
      },
      { uid: true },
    );
    for (const uid of (uids || []).slice(-30).reverse()) {
      const message = await mail.fetchOne(uid, { source: true }, { uid: true });
      for (const bounce of await parseGmailDsn(message?.source))
        matched += (await applyBounce(store, bounce)).count;
    }
    await store.rateLimit.updateMany({
      where: { id: "gmail-bounce-scan", resetsAt: until },
      data: { count: 1 },
    });
    authLog("bounce_scan_completed", {
      status: "Checked",
      reason: `matched_${matched}`,
    });
    return { status: "checked", matched };
  } catch {
    await store.rateLimit.updateMany({
      where: { id: "gmail-bounce-scan", resetsAt: until },
      data: { count: -1 },
    });
    authLog("bounce_scan_failed", { reason: "imap_check_failed" });
    return { status: "unavailable", matched };
  } finally {
    clearTimeout(timer);
    lock?.release();
    mail.close();
  }
}
