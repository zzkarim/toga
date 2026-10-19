import assert from "node:assert/strict";
import { db } from "../lib/db.js";
import { requestVerification, otpEmailId } from "../lib/verification.js";
import { hash } from "../lib/security.js";
const base = process.env.TEST_URL || "http://127.0.0.1:3004";
if (
  !["127.0.0.1", "localhost"].includes(
    new URL(process.env.DATABASE_URL).hostname,
  ) ||
  (process.env.GMAIL_APP_PASSWORD || process.env.RESEND_API_KEY)
)
  throw Error("Local test only");
const email = `failure-test-${Date.now()}@gatech.edu`;
let calls = 0;
const accepted = async () => {
  calls++;
  return { deliveryStatus: "Accepted" };
};
const opts = { configured: true, send: accepted };
const request = (o = opts) => requestVerification(email, o);
const cooldown = () =>
  db.emailOtp.update({ where: { email }, data: { resendAt: new Date(0) } });
try {
  const results = await Promise.allSettled([request(), request(), request()]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(calls, 1);
  const initial = results.find((r) => r.status === "fulfilled").value;
  for (let i = 0; i < 8; i++)
    await assert.rejects(request(), (e) => e.status === 429);
  assert.equal(
    (
      await db.rateLimit.findUnique({
        where: { id: hash(`otp-request:${email}`) },
      })
    ).count,
    1,
  );
  const original = await db.emailOtp.findUnique({ where: { email } });
  for (const status of ["Failed", "Retry", "Unknown"]) {
    await cooldown();
    await assert.rejects(
      request({
        configured: true,
        send: async () => ({
          deliveryStatus: status,
          error: "private SMTP detail",
        }),
      }),
      (e) => e.status === 503 && !e.message.includes("SMTP"),
    );
    const current = await db.emailOtp.findUnique({ where: { email } });
    assert.equal(current.challenge, original.challenge);
    assert.equal(current.digest, original.digest);
    assert.ok(current.resendAt > new Date());
  }
  await cooldown();
  await assert.rejects(
    request({
      configured: true,
      send: async () => {
        throw Error("private detail");
      },
    }),
    (e) => e.status === 503 && !e.message.includes("private"),
  );
  assert.equal(await db.user.count({ where: { email } }), 0);
  await db.email.create({
    data: {
      id: otpEmailId(initial.challenge),
      to: email,
      subject: "Your Toga verification code",
      text: "Authentication content omitted.",
      deliveryStatus: "Bounced",
    },
  });
  async function status(challenge) {
    const r = await fetch(base + "/api/auth/otp/status", {
      method: "POST",
      headers: { Origin: base, "Content-Type": "application/json" },
      body: JSON.stringify({ email, challenge }),
    });
    assert.equal(r.status, 200);
    return r.json();
  }
  assert.equal((await status(initial.challenge)).status, "Bounced");
  assert.equal((await status("b".repeat(48))).status, "Unavailable");
  await cooldown();
  await assert.rejects(request(), (e) => e.status === 429);
  assert.equal(calls, 1);
  // Jobs must not claim a just-created auth message or replay redacted auth bodies.
  const queued = [
    {
      id: email + "-fresh",
      subject: "Your Toga verification code",
      createdAt: new Date(),
      attempts: 0,
    },
    {
      id: email + "-stale",
      subject: "Your Toga verification code",
      createdAt: new Date(Date.now() - 180000),
      attempts: 0,
    },
    {
      id: email + "-exhausted",
      subject: "Rental notification",
      createdAt: new Date(),
      attempts: 5,
    },
  ];
  for (const row of queued)
    await db.email.create({
      data: {
        ...row,
        to: email,
        text: "Authentication content omitted.",
        deliveryStatus: "Queued",
      },
    });
  const job = await fetch(base + "/api/jobs", {
    method: "POST",
    headers: {
      Origin: base,
      Authorization: `Bearer ${process.env.CRON_SECRET}`,
    },
  });
  assert.equal(job.status, 200);
  for (const [index, expected] of ["Queued", "Failed", "Failed"].entries())
    assert.equal(
      (await db.email.findUnique({ where: { id: queued[index].id } }))
        .deliveryStatus,
      expected,
    );
  console.log(
    "PASS verification failures, concurrent sends, cooldown accounting, prior-code preservation, safe status polling and account integrity",
  );
} finally {
  await db.email.deleteMany({ where: { to: email } });
  await db.emailOtp.deleteMany({ where: { email } });
  await db.rateLimit.deleteMany({
    where: {
      id: { in: [hash(`otp-request:${email}`), hash("otp-request:global")] },
    },
  });
  await db.$disconnect();
}
