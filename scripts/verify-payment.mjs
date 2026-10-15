import { TERMS_VERSION, PRIVACY_VERSION } from "../lib/legal.mjs";
import { PrismaClient } from "@prisma/client";
import { randomBytes, createHash } from "node:crypto";
import assert from "node:assert/strict";
if (
  !process.argv.includes("--allow-hosted-check") ||
  process.env.APP_URL !== "https://toga-ecru.vercel.app"
)
  throw new Error("Explicit hosted payment check required");
const db = new PrismaClient(),
  id = `payment-check-${randomBytes(12).toString("hex")}`,
  token = randomBytes(32).toString("hex");
const base = process.env.APP_URL,
  profile = {
    name: "Temporary payment check",
    phone: "4045550100",
    classYear: null,
    profilePhotoUrl: null,
  };
const headers = {
  Cookie: `toga_session=${token}`,
  Origin: base,
  "Content-Type": "application/json",
};
async function patch(data) {
  return fetch(`${base}/api/me`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(data),
  });
}
try {
  await db.user.create({
    data: {
      id,
      email: `${id}@gatech.edu`,
      ...profile,
      paymentInfo: "Venmo: @preserved",
      termsAcceptedAt: new Date(),
      ageConfirmedAt: new Date(),
      termsVersion: TERMS_VERSION,
      privacyVersion: PRIVACY_VERSION,
    },
  });
  await db.session.create({
    data: {
      id: createHash("sha256").update(token).digest("hex"),
      userId: id,
      expiresAt: new Date(Date.now() + 300000),
    },
  });
  for (const paymentInfo of [
    "Venmo: @username",
    "Zelle: 404-555-1234",
    "PayPal: username",
    "Cash at pickup",
    "Cash or Venmo",
  ]) {
    assert.equal((await patch({ ...profile, paymentInfo })).status, 200);
    const response = await fetch(`${base}/api/me`, { headers });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).user.paymentInfo, paymentInfo);
  }
  assert.equal((await patch(profile)).status, 200);
  assert.equal(
    (await db.user.findUnique({ where: { id } })).paymentInfo,
    "Cash or Venmo",
  );
  for (const paymentInfo of ["x".repeat(501), {}, null])
    assert.equal((await patch({ ...profile, paymentInfo })).status, 400);
  assert.equal((await patch({ ...profile, venmoHandle: "stale" })).status, 400);
  assert.equal(
    (await db.user.findUnique({ where: { id } })).paymentInfo,
    "Cash or Venmo",
  );
  assert.equal((await patch({ ...profile, paymentInfo: "" })).status, 200);
  assert.equal((await db.user.findUnique({ where: { id } })).paymentInfo, "");
  console.log(
    "PASS: live payment save/reload for all requested formats, omitted-field preservation, invalid-payload rejection, stale-client rejection, explicit clearing.",
  );
} finally {
  await db.session.deleteMany({ where: { userId: id } });
  await db.user.deleteMany({ where: { id } });
  await db.$disconnect();
  console.log("Temporary check records removed.");
}
