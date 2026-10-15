import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
const db = new PrismaClient(),
  base = process.env.TEST_URL || "http://127.0.0.1:3003";
if (
  !["localhost", "127.0.0.1"].includes(new URL(base).hostname) ||
  (process.env.SENDGRID_API_KEY || process.env.GMAIL_APP_PASSWORD)
)
  throw new Error("Local tests with email disabled only");
const email = `otp-test-${Date.now()}@gatech.edu`;
const hash = (s) => createHash("sha256").update(s).digest("hex");
let cookie = "";
async function post(path, body, status = 200) {
  const res = await fetch(base + "/api/" + path, {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  assert.equal(res.status, status, `Unexpected status on ${path}`);
  if (res.headers.get("set-cookie"))
    cookie = res.headers.get("set-cookie").split(";")[0];
  return res.json();
}
async function request() {
  return post("auth/otp/request", { email });
}
async function verify(p, code = p.previewCode, status = 200) {
  return post(
    "auth/otp/verify",
    { email, challenge: p.challenge, code },
    status,
  );
}
async function cooldown() {
  await db.emailOtp.update({
    where: { email },
    data: { resendAt: new Date(0) },
  });
}
try {
  await post("auth/otp/request", { email: "invalid@gmail.com" }, 400);
  const a = await request();
  assert.match(a.previewCode, /^\d{6}$/);
  assert.equal(
    (await db.email.findFirst({ where: { to: email } })).text,
    "Authentication content omitted.",
  );
  await post("auth/otp/request", { email }, 429);
  const bad = a.previewCode === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i++) await verify(a, bad, 400);
  await verify(a, a.previewCode, 400);
  await cooldown();
  const b = await request();
  await verify(a, a.previewCode, 400);
  await db.emailOtp.update({
    where: { email },
    data: { expiresAt: new Date(0) },
  });
  const expired = await verify(b, b.previewCode, 400);
  assert.match(expired.error, /expired/);
  await cooldown();
  const c = await request();
  const results = await Promise.all(
    [1, 2].map(() =>
      fetch(base + "/api/auth/otp/verify", {
        method: "POST",
        headers: { Origin: base, "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          challenge: c.challenge,
          code: c.previewCode,
        }),
      }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 400]);
  const success = results.find((r) => r.status === 200);
  cookie = success.headers.get("set-cookie").split(";")[0];
  assert.match(success.headers.get("set-cookie"), /Max-Age=2592000/i);
  assert.match(success.headers.get("set-cookie"), /HttpOnly/i);
  const sessionId = hash(cookie.split("=")[1]);
  await db.session.update({
    where: { id: sessionId },
    data: {
      expiresAt: new Date(Date.now() + 86400000),
      passwordSetupUntil: new Date(0),
    },
  });
  for (let i = 0; i < 2; i++) {
    const me = await fetch(base + "/api/me", { headers: { Cookie: cookie } });
    assert.equal((await me.json()).user.email, email);
    if (i === 0) assert.match(me.headers.get("set-cookie"), /Max-Age=2592000/i);
  }
  const renewed = await db.session.findUnique({ where: { id: sessionId } });
  assert.ok(renewed.expiresAt > new Date(Date.now() + 29 * 86400000));
  assert.equal(+renewed.passwordSetupUntil, 0);
  const change = await fetch(base + "/api/auth/password", {
    method: "POST",
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({ password: "a secure example password" }),
  });
  assert.equal(change.status, 401);
  await fetch(base + "/api/auth/logout", {
    method: "POST",
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: "{}",
  });
  assert.equal(
    (
      await (
        await fetch(base + "/api/me", { headers: { Cookie: cookie } })
      ).json()
    ).user,
    null,
  );
  console.log(
    "PASS: OTP cooldown, locked attempts, expiry, resend invalidation, atomic one-time use, redacted email history, persistent/renewed sessions and logout.",
  );
} finally {
  await db.user.deleteMany({ where: { email } });
  await db.emailOtp.deleteMany({ where: { email } });
  await db.email.deleteMany({ where: { to: email } });
  await db.rateLimit.deleteMany({
    where: {
      id: { in: ["otp-request:", "otp-verify:"].map((p) => hash(p + email)) },
    },
  });
  await db.$disconnect();
}
