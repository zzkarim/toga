import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { randomBytes, createHash } from "node:crypto";
import { Webhook } from "svix";
import { hashPassword, verifyPassword } from "../lib/passwords.mjs";
import { TERMS_VERSION, PRIVACY_VERSION } from "../lib/legal.mjs";
const base = process.env.TEST_URL || "http://127.0.0.1:3004",
  db = new PrismaClient();
if (
  !["localhost", "127.0.0.1"].includes(new URL(base).hostname) ||
  !["localhost", "127.0.0.1"].includes(
    new URL(process.env.DATABASE_URL).hostname,
  ) ||
  process.env.RESEND_API_KEY ||
  process.env.GMAIL_APP_PASSWORD
)
  throw Error("Isolated local database and email preview only");
const prefix = `migration-${Date.now()}`,
  emails = [],
  ids = [],
  pass = "local fixture password 123",
  hash = (s) => createHash("sha256").update(s).digest("hex");
let cookie = "";
async function call(path, body, status = 200, method = "POST") {
  const r = await fetch(`${base}/api/${path}`, {
    method,
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json();
  assert.equal(r.status, status, `${path}: ${JSON.stringify(data)}`);
  if (r.headers.get("set-cookie")) {
    cookie = r.headers.get("set-cookie").split(";")[0];
    assert.match(
      r.headers.get("set-cookie"),
      /Max-Age=2592000|Max-Age=0|Expires=Thu, 01 Jan 1970/,
    );
  }
  return data;
}
async function code(email, purpose = "signup") {
  const challenge = await call("auth/otp/request", { email, purpose });
  const stored = await db.emailOtp.findUnique({ where: { email } });
  assert.notEqual(stored.digest, challenge.previewCode);
  return call("auth/otp/verify", {
    email,
    purpose,
    challenge: challenge.challenge,
    code: challenge.previewCode,
  });
}
async function fixture(
  suffix,
  password = false,
  verified = false,
  complete = false,
) {
  const email = `${prefix}-${suffix}@gatech.edu`;
  emails.push(email);
  const user = await db.user.create({
    data: {
      email,
      passwordHash: password ? await hashPassword(pass) : null,
      emailVerifiedAt: verified ? new Date() : null,
      ...(complete
        ? {
            name: "Migration Fixture",
            phone: "+14045550111",
            termsAcceptedAt: new Date(),
            ageConfirmedAt: new Date(),
            termsVersion: TERMS_VERSION,
            privacyVersion: PRIVACY_VERSION,
          }
        : {}),
    },
  });
  ids.push(user.id);
  return user;
}
async function session(user) {
  const raw = randomBytes(32).toString("hex");
  await db.session.create({
    data: {
      id: hash(raw),
      userId: user.id,
      expiresAt: new Date(Date.now() + 86400000),
    },
  });
  cookie = `toga_session=${raw}`;
  return hash(raw);
}
try {
  const config = await call("config", undefined, 200, "GET");
  assert.equal(config.enforceVerifiedAccounts, true);
  await call(
    "auth/signup",
    { email: `${prefix}@gatech.edu`, password: pass, confirmPassword: pass },
    409,
  );
  await call("auth/otp/request", { email: "outsider@gmail.com" }, 400);
  const freshEmail = `${prefix}-new@gatech.edu`;
  emails.push(freshEmail);
  assert.equal((await code(freshEmail)).next, "/secure-account");
  const fresh = await db.user.findUnique({ where: { email: freshEmail } });
  ids.push(fresh.id);
  assert.ok(fresh.emailVerifiedAt);
  assert.equal(fresh.passwordHash, null);
  await call("listings", undefined, 428, "GET");
  await call("auth/password", { password: pass }, 400);
  await call(
    "auth/password",
    { password: pass, confirmPassword: "different" },
    400,
  );
  assert.equal(
    (await call("auth/password", { password: pass, confirmPassword: pass }))
      .next,
    "/accept-terms",
  );
  const stored = await db.user.findUnique({ where: { id: fresh.id } });
  assert.ok(await verifyPassword(pass, stored.passwordHash));
  assert.notEqual(stored.passwordHash, pass);
  await call("legal/accept", {
    accepted: true,
    termsVersion: TERMS_VERSION,
    privacyVersion: PRIVACY_VERSION,
  });
  await call("me", { name: "New Fixture", phone: "4045550111" }, 200, "PATCH");
  await call("auth/logout", {});
  await call(
    "auth/password-login",
    { email: freshEmail, password: "incorrect" },
    401,
  );
  assert.equal(
    (await call("auth/password-login", { email: freshEmail, password: pass }))
      .next,
    "/?view=browse",
  );
  await call("auth/password", { password: pass, confirmPassword: pass }, 401);
  const recoveryUser = await fixture("recovery", true, true, true);
  cookie = "";
  assert.equal(
    (await code(recoveryUser.email, "recovery")).next,
    "/secure-account?reset=1",
  );
  const nextPass = pass + " changed";
  await call("auth/password", {
    password: nextPass,
    confirmPassword: nextPass,
  });
  await call(
    "auth/password-login",
    { email: recoveryUser.email, password: pass },
    401,
  );
  await call("auth/password-login", {
    email: recoveryUser.email,
    password: nextPass,
  });
  for (const active of [false, true]) {
    const legacy = await fixture(`legacy-${active}`, false, false, true);
    cookie = "";
    let oldSession;
    if (active) oldSession = await session(legacy);
    if (active) {
      assert.equal(
        (await call("me", undefined, 200, "GET")).user.needsAccountSecurity,
        true,
      );
      await call(
        "auth/password",
        { password: pass, confirmPassword: pass },
        428,
      );
    } else
      await call(
        "auth/password-login",
        { email: legacy.email, password: pass },
        401,
      );
    assert.equal(
      (await code(legacy.email, active ? "migrate" : "signup")).next,
      "/secure-account",
    );
    assert.equal(
      (await db.user.findUnique({ where: { email: legacy.email } })).id,
      legacy.id,
    );
    if (active)
      assert.ok(await db.session.findUnique({ where: { id: oldSession } }));
    assert.equal(
      (await call("auth/password", { password: pass, confirmPassword: pass }))
        .next,
      "/?view=browse",
    );
    assert.equal(
      (await db.user.findUnique({ where: { id: legacy.id } })).name,
      legacy.name,
    );
    await call("auth/logout", {});
    await call("auth/password-login", { email: legacy.email, password: pass });
  }
  const existing = await fixture("password", true, false, true);
  cookie = "";
  assert.equal(
    (
      await call("auth/password-login", {
        email: existing.email,
        password: pass,
      })
    ).next,
    "/secure-account",
  );
  assert.equal((await code(existing.email, "migrate")).next, "/?view=browse");
  assert.equal(
    (await db.user.findUnique({ where: { id: existing.id } })).passwordHash,
    existing.passwordHash,
  );
  const verified = await fixture("verified", true, true, true);
  assert.equal(
    (
      await call("auth/password-login", {
        email: verified.email,
        password: pass,
      })
    ).next,
    "/?view=browse",
  );
  const partial = await fixture("partial");
  cookie = "";
  assert.equal((await code(partial.email)).next, "/secure-account");
  assert.equal(
    (await db.user.findUnique({ where: { email: partial.email } })).id,
    partial.id,
  );
  // Signed webhook, replay and out-of-order terminal events against disposable outbox record.
  const messageId = `${prefix}-provider`,
    localId = `${prefix}-mail`,
    secret = process.env.RESEND_WEBHOOK_SECRET;
  await db.email.create({
    data: {
      id: localId,
      to: freshEmail,
      subject: "Fixture",
      text: "Fixture",
      provider: "resend",
      providerMessageId: messageId,
      deliveryStatus: "Accepted",
    },
  });
  async function event(type, id, valid = true) {
    const body = JSON.stringify({
        type,
        created_at: new Date().toISOString(),
        data: { email_id: messageId },
      }),
      timestamp = new Date();
    const signature = new Webhook(secret).sign(id, timestamp, body);
    const r = await fetch(`${base}/api/webhooks/resend`, {
      method: "POST",
      headers: {
        "svix-id": id,
        "svix-timestamp": String(Math.floor(+timestamp / 1000)),
        "svix-signature": valid ? signature : "invalid",
      },
      body,
    });
    assert.equal(r.status, valid ? 200 : 400);
  }
  await event("email.delivered", `${prefix}-invalid`, false);
  assert.equal(
    (await db.email.findUnique({ where: { id: localId } })).deliveryStatus,
    "Accepted",
  );
  await event("email.delivered", `${prefix}-delivered`);
  await event("email.delivered", `${prefix}-delivered`);
  assert.equal(
    (await db.email.findUnique({ where: { id: localId } })).deliveryStatus,
    "Delivered",
  );
  await event("email.bounced", `${prefix}-bounced`);
  await event("email.delivered", `${prefix}-late`);
  assert.equal(
    (await db.email.findUnique({ where: { id: localId } })).deliveryStatus,
    "Bounced",
  );
  assert.equal(
    await db.emailDeliveryEvent.count({
      where: { providerMessageId: messageId },
    }),
    3,
  );
  console.log(
    "PASS: verified signup, password confirmation/hash/login/reset, same-ID migration with/without session, retained existing password/profile, partial signup resume, security gates, 30-day cookies, signed webhook/replay/bounce precedence.",
  );
} finally {
  await db.emailDeliveryEvent.deleteMany({
    where: { id: { startsWith: prefix } },
  });
  await db.email.deleteMany({
    where: {
      OR: [
        { to: { in: emails } },
        { text: { contains: prefix } },
        { id: { in: ids.map((id) => `admin-signup-${id}`) } },
      ],
    },
  });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.emailOtp.deleteMany({ where: { email: { in: emails } } });
  await db.rateLimit.deleteMany({
    where: {
      id: {
        in: emails.flatMap((email) =>
          ["otp-request:", "otp-verify:", "password:"].map((p) =>
            hash(p + email),
          ),
        ),
      },
    },
  });
  await db.$disconnect();
}
