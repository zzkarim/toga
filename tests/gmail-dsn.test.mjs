import test from "node:test";
import assert from "node:assert/strict";
import { parseGmailDsn } from "../lib/gmail-dsn.mjs";
import { applyBounce, syncGmailBounces } from "../lib/gmail-bounces.js";
import { emailStatusLabel, smtpDiagnostic } from "../lib/email-status.mjs";
const id = `<toga.${"a".repeat(64)}@gmail.com>`;
const source = `From: Mail Delivery Subsystem <mailer-daemon@googlemail.com>
Return-Path: <>
Authentication-Results: mx.google.com; dkim=pass header.i=@googlemail.com; dmarc=pass header.from=googlemail.com
MIME-Version: 1.0
Content-Type: multipart/report; report-type=delivery-status; boundary="dsn"

--dsn
Content-Type: text/plain

Message blocked
--dsn
Content-Type: message/delivery-status

Reporting-MTA: dns; googlemail.com

Final-Recipient: rfc822; example@gatech.edu
Action: failed
Status: 5.7.1
Diagnostic-Code: smtp; Message rejected. private-original-content

--dsn
Content-Type: message/rfc822

Message-ID: ${id}
From: Toga <jointoga@gmail.com>
To: example@gatech.edu
Subject: Your Toga verification code

private-original-content
--dsn--
`;
test("authenticated Google DSN extracts exact message/recipient and safe diagnostic", async () => {
  const [bounce] = await parseGmailDsn(Buffer.from(source));
  assert.deepEqual(bounce, {
    providerMessageId: id,
    recipient: "example@gatech.edu",
    status: "5.7.1",
    error: "Gmail delivery failure (5.7.1). Message rejected by mail policy.",
  });
  assert.ok(!JSON.stringify(bounce).includes("private-original"));
});
test("spoofed, nonfailure, malformed, oversized and unmatched DSNs are ignored", async () => {
  for (const altered of [
    source.replace("dkim=pass", "dkim=fail"),
    source.replace("mx.google.com", "attacker.example"),
    source.replace("Return-Path: <>", "Return-Path: <attacker@example.com>"),
    source.replace("Action: failed", "Action: delayed"),
    source.replace(id, "<other@example.com>"),
    source.replace("report-type=delivery-status", "report-type=other"),
    source.replace("dmarc=pass", "dmarc=fail"),
  ])
    assert.deepEqual(await parseGmailDsn(Buffer.from(altered)), []);
  assert.deepEqual(await parseGmailDsn(Buffer.alloc(262145)), []);
});
test("bounce update matches both identifiers, is idempotent, never marks unrelated or failed mail", async () => {
  const records = [
    {
      providerMessageId: id,
      to: "example@gatech.edu",
      deliveryStatus: "Accepted",
    },
    {
      providerMessageId: id,
      to: "different@gatech.edu",
      deliveryStatus: "Accepted",
    },
    {
      providerMessageId: "other",
      to: "example@gatech.edu",
      deliveryStatus: "Accepted",
    },
  ];
  const store = {
    email: {
      updateMany: async ({ where, data }) => {
        let count = 0;
        for (const r of records)
          if (
            r.providerMessageId === where.providerMessageId &&
            r.to === where.to &&
            where.deliveryStatus.in.includes(r.deliveryStatus)
          ) {
            Object.assign(r, data);
            count++;
          }
        return { count };
      },
    },
  };
  const [bounce] = await parseGmailDsn(Buffer.from(source));
  assert.equal((await applyBounce(store, bounce)).count, 1);
  assert.equal((await applyBounce(store, bounce)).count, 0);
  assert.equal(records[0].deliveryStatus, "Bounced");
  assert.equal(records[1].deliveryStatus, "Accepted");
  assert.equal(records[2].deliveryStatus, "Accepted");
});
test("bounce monitor disabled without Gmail and stops safely on IMAP failure", async () => {
  assert.equal(
    (await syncGmailBounces({ configured: false })).status,
    "disabled",
  );
  let closed = false;
  const store = {
    $queryRaw: async () => [{ id: "gmail-bounce-scan" }],
    rateLimit: { updateMany: async () => ({ count: 1 }) },
  };
  const client = {
    connect: async () => {
      throw Error("private credential");
    },
    close: () => {
      closed = true;
    },
  };
  assert.equal(
    (await syncGmailBounces({ configured: true, store, client })).status,
    "unavailable",
  );
  assert.ok(closed);
});
test("admin labels distinguish acceptance and diagnostics never copy arbitrary SMTP text", () => {
  assert.equal(
    emailStatusLabel("Accepted"),
    "Provider accepted (delivery unconfirmed)",
  );
  const diagnostic = smtpDiagnostic({
    responseCode: 550,
    response: "550 5.7.1 private-code-and-address",
    code: "EAUTH",
  });
  assert.match(diagnostic, /550/);
  assert.match(diagnostic, /5.7.1/);
  assert.ok(!diagnostic.includes("private"));
});
