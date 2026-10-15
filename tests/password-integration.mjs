import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const base = process.env.TEST_URL || "http://127.0.0.1:3003";
if (
  !["localhost", "127.0.0.1"].includes(new URL(base).hostname) ||
  process.env.SENDGRID_API_KEY
)
  throw new Error("Local, email-disabled tests only");
const email = `password-test-${Date.now()}@gatech.edu`;
let cookie = "";
async function call(path, body, expected = 200, useCookie = cookie) {
  const response = await fetch(base + "/api/" + path, {
    method: body ? "POST" : "GET",
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      Cookie: useCookie,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  assert.equal(response.status, expected, JSON.stringify(data));
  if (response.headers.get("set-cookie"))
    cookie = response.headers.get("set-cookie").split(";")[0];
  assert.equal(JSON.stringify(data).includes("passwordHash"), false);
  return data;
}
try {
  await call(
    "auth/password-login",
    { email, password: "not a real password" },
    401,
  );
  const { preview } = await call("auth/login", { email });
  const token = new URL(preview).searchParams.get("token");
  await call("auth/verify", { token });
  const oldSession = cookie;
  await call("auth/password", { password: "short" }, 400);
  await call("auth/password", { password: "a long unique password 123" });
  assert.equal((await call("me", null, 200, oldSession)).user, null);
  await call("auth/logout", {});
  await call("auth/password-login", { email, password: "wrong password" }, 401);
  await call("auth/password-login", {
    email,
    password: "a long unique password 123",
  });
  assert.equal((await call("me")).user.hasPassword, true);
  await call("auth/password", { password: "another long password 456" }, 401);
  await call("auth/password", {
    password: "another long password 456",
    currentPassword: "a long unique password 123",
  });
  await call(
    "auth/password-login",
    { email, password: "a long unique password 123" },
    401,
  );
  const recovery = await call("auth/login", { email });
  await call("auth/verify", {
    token: new URL(recovery.preview).searchParams.get("token"),
  });
  await call("auth/password", { password: "recovered long password 789" });
  await call("auth/logout", {});
  await call("auth/password-login", {
    email,
    password: "recovered long password 789",
  });
  for (let i = 0; i < 5; i++)
    await call("auth/password-login", { email, password: "wrong" }, 401);
  await call("auth/password-login", { email, password: "wrong" }, 429);
  console.log(
    "PASS: verified setup, password login, logout, recovery, session revocation, hash redaction, and rate limiting.",
  );
} finally {
  await db.user.deleteMany({ where: { email } });
  await db.email.deleteMany({ where: { to: email } });
  await db.loginToken.deleteMany({ where: { email } });
  await db.rateLimit.deleteMany({ where: { id: { contains: email } } });
  await db.$disconnect();
}
