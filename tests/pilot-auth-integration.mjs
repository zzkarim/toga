import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { TERMS_VERSION, PRIVACY_VERSION } from "../lib/legal.mjs";
import { queuedNotifications } from "../lib/email.js";
import { verifyPassword } from "../lib/passwords.mjs";
const base = process.env.TEST_URL || "http://127.0.0.1:3004";
if (
  !["localhost", "127.0.0.1"].includes(new URL(base).hostname) ||
  !["localhost", "127.0.0.1"].includes(
    new URL(process.env.DATABASE_URL).hostname,
  ) ||
  (process.env.GMAIL_APP_PASSWORD || process.env.RESEND_API_KEY)
)
  throw Error("Local email-disabled test only");
const db = new PrismaClient(),
  tag = "pilot-" + randomUUID(),
  email = tag + "@gatech.edu",
  legacyEmail = tag + "-legacy@gatech.edu",
  password = "local pilot password 123";
let cookie = "",
  ids = [];
const digest = (s) => createHash("sha256").update(s).digest("hex");
async function call(path, body, expected = 200, session = cookie, method) {
  const r = await fetch(base + "/api/" + path, {
    method: method || (body ? "POST" : "GET"),
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      Cookie: session,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const value = await r.json();
  assert.equal(r.status, expected, `${path}: ${JSON.stringify(value)}`);
  if (r.headers.get("set-cookie"))
    cookie = r.headers.get("set-cookie").split(";")[0];
  assert.ok(!JSON.stringify(value).includes("passwordHash"));
  return value;
}
async function countMonitoring() {
  return db.email.count({
    where: {
      OR: ids
        .map((id) => ({ text: { contains: id } }))
        .concat([
          { text: { contains: email } },
          { text: { contains: legacyEmail } },
        ]),
      subject: { startsWith: "Toga Admin" },
    },
  });
}
async function until(check) {
  for (let i = 0; i < 30; i++) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.fail("Background monitoring did not complete");
}
try {
  assert.equal((await call("config")).requireEmailVerification, false);
  await call(
    "auth/signup",
    { email: "wrong@gmail.com", password, confirmPassword: password },
    400,
  );
  await call(
    "auth/signup",
    { email, password, confirmPassword: "different" },
    400,
  );
  await call(
    "auth/signup",
    { email, password: "short", confirmPassword: "short" },
    400,
  );
  const signup = await call("auth/signup", {
    email: email.toUpperCase(),
    password,
    confirmPassword: password,
  });
  assert.equal(signup.next, "/accept-terms");
  const user = await db.user.findUnique({ where: { email } });
  ids.push(user.id);
  assert.ok(await verifyPassword(password, user.passwordHash));
  assert.equal(user.name, "");
  assert.equal(user.phone, "");
  assert.equal(user.termsAcceptedAt, null);
  assert.equal(user.paymentInfo, null);
  assert.equal(
    await db.email.count({
      where: {
        to: email,
        subject: {
          in: ["Your Toga verification code", "Your Toga sign-in link"],
        },
      },
    }),
    0,
  );
  await until(
    async () =>
      (await db.email.count({ where: { id: "admin-signup-" + user.id } })) ===
      1,
  );
  await call(
    "auth/signup",
    { email: email.toUpperCase(), password, confirmPassword: password },
    409,
  );
  await call("listings", null, 428);
  await call("legal/accept", {
    accepted: true,
    termsVersion: TERMS_VERSION,
    privacyVersion: PRIVACY_VERSION,
  });
  const gate = await fetch(base + "/", {
    headers: { Cookie: cookie },
    redirect: "manual",
  });
  assert.equal(gate.status, 307);
  assert.match(gate.headers.get("location"), /complete-profile/);
  await call("me", { name: "", phone: "4045550100" }, 400, cookie, "PATCH");
  await call("me", { name: "Pilot test", phone: "" }, 400, cookie, "PATCH");
  await call(
    "me",
    { name: "Pilot test", phone: "4045550100" },
    200,
    cookie,
    "PATCH",
  );
  assert.equal((await call("me")).user.paymentInfo, null);
  await call("listings");
  const initialCookie = cookie;
  for (let i = 0; i < 3; i++) await call("me");
  assert.equal(await countMonitoring(), 1);
  await call("auth/logout", {});
  await call("auth/password-login", { email, password: "incorrect" }, 401);
  assert.equal(await countMonitoring(), 1);
  const login = await call("auth/password-login", { email, password });
  assert.equal(login.next, "/?view=browse");
  await until(async () => (await countMonitoring()) === 2);
  for (let i = 0; i < 3; i++) {
    await call("me");
    await call("listings");
  }
  assert.equal(await countMonitoring(), 2);
  assert.equal((await call("me", null, 200, initialCookie)).user, null);
  const sessions = await db.session.findMany({ where: { userId: user.id } });
  assert.ok(sessions.some((s) => s.expiresAt > Date.now() + 29 * 86400000));
  // Existing verified-by-session legacy identity can establish its FIRST password, even after the old 15-minute window.
  const legacy = await db.user.create({
    data: {
      email: legacyEmail,
      name: "Legacy",
      phone: "4045550101",
      termsAcceptedAt: new Date(),
      ageConfirmedAt: new Date(),
      termsVersion: TERMS_VERSION,
      privacyVersion: PRIVACY_VERSION,
    },
  });
  ids.push(legacy.id);
  const token = randomUUID();
  await db.session.create({
    data: {
      id: digest(token),
      userId: legacy.id,
      expiresAt: new Date(Date.now() + 86400000),
      canSetPassword: true,
      passwordSetupUntil: new Date(0),
    },
  });
  cookie = "toga_session=" + token;
  await call(
    "auth/signup",
    { email: legacyEmail, password, confirmPassword: password },
    409,
  );
  await call("auth/password", { password });
  assert.ok(
    (await db.user.findUnique({ where: { id: legacy.id } })).passwordHash,
  );
  await call("auth/password", { password: "attacker knows the email" }, 401);
  await call("auth/password-login", { email: legacyEmail, password });
  await until(async () => (await countMonitoring()) === 3);
  // Recovery remains ownership-proof based; new addresses cannot receive unnecessary code emails.
  await call("auth/otp/request", { email: tag + "-new@gatech.edu" }, 400);
  await call("auth/login", { email: tag + "-new@gatech.edu" }, 400);
  for (let i = 0; i < 8; i++)
    await call("auth/password-login", { email, password: "wrong" }, 401);
  await call("auth/password-login", { email, password: "wrong" }, 429);
  // A monitoring backlog must not hide a new user notification or reminder.
  const priorityRows = Array.from({ length: 55 }, (_, i) => ({
    id: tag + "-monitor-" + i,
    to: email,
    subject: "Toga Admin — User signed in",
    text: tag,
    createdAt: new Date(0),
  }));
  // Use recent dates within the retry window; monitoring is deliberately older.
  for (const row of priorityRows) row.createdAt = new Date(Date.now() - 60000);
  priorityRows.push(
    {
      id: tag + "-user",
      to: email,
      subject: "Your rental was accepted on Toga",
      text: tag,
    },
    { id: "reminder-" + tag, to: email, subject: "Pickup reminder", text: tag },
  );
  await db.email.createMany({ data: priorityRows });
  const queue = await queuedNotifications({
    email: {
      findMany: (args) =>
        db.email.findMany({
          ...args,
          where: { AND: [args.where, { to: email }] },
        }),
    },
  });
  const userIndex = queue.findIndex((r) => r.id === tag + "-user"),
    reminderIndex = queue.findIndex((r) => r.id === "reminder-" + tag),
    monitorIndex = queue.findIndex((r) => r.id.startsWith(tag + "-monitor-"));
  assert.ok(
    userIndex >= 0 && reminderIndex > userIndex && monitorIndex > reminderIndex,
  );
  console.log(
    "PASS pilot signup without email, domain and uniqueness, hashing, legal/profile gates, optional payment, password login/session, one monitoring event per explicit auth, no refresh events, safe legacy first-password setup and recovery protection.",
  );
} finally {
  await db.email.deleteMany({
    where: {
      OR: [{ to: { in: [email, legacyEmail] } }, { text: { contains: tag } }],
    },
  });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.emailOtp.deleteMany({
    where: { email: { in: [email, legacyEmail] } },
  });
  await db.$disconnect();
}
