import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { randomUUID, createHash } from "node:crypto";
import { TERMS_VERSION, PRIVACY_VERSION } from "../lib/legal.mjs";
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
  prefix = "recency-" + randomUUID(),
  ids = [],
  token = randomUUID();
try {
  // Deliberately insert the newer records before the older records.
  for (const [suffix, createdAt] of [
    ["new", new Date(Date.now() + 120000)],
    ["old", new Date(Date.now() + 60000)],
  ]) {
    const id = prefix + "-" + suffix;
    ids.push(id);
    await db.user.create({
      data: {
        id,
        email: id + "@gatech.edu",
        role: "admin",
        name: "Recency test",
        phone: "4045551234",
        createdAt,
        termsAcceptedAt: new Date(),
        ageConfirmedAt: new Date(),
        termsVersion: TERMS_VERSION,
        privacyVersion: PRIVACY_VERSION,
      },
    });
    await db.listing.create({
      data: {
        id,
        ownerId: id,
        title: id,
        description: "Disposable",
        size: "M",
        condition: "Good",
        price: 1,
        photos: "[]",
        createdAt,
      },
    });
    await db.rentalRequest.create({
      data: {
        id,
        listingId: id,
        lenderId: id,
        renterId: id,
        startDate: new Date(),
        endDate: new Date(),
        createdAt,
        status: "Completed",
      },
    });
    await db.problemReport.create({
      data: {
        id,
        requestId: id,
        reporterId: id,
        description: "Disposable",
        createdAt,
      },
    });
    await db.email.create({
      data: {
        id,
        to: id + "@gatech.edu",
        subject: "Disposable recency test",
        text: "Test",
        createdAt,
        deliveryStatus: "Failed",
      },
    });
    await db.adminAudit.create({
      data: {
        id,
        adminId: id,
        targetId: id,
        targetType: "users",
        action: "test",
        note: "Disposable",
        createdAt,
      },
    });
  }
  await db.session.create({
    data: {
      id: createHash("sha256").update(token).digest("hex"),
      userId: ids[0],
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  const response = await fetch(base + "/api/admin", {
    headers: { Cookie: "toga_session=" + token },
  });
  assert.equal(response.status, 200);
  const data = await response.json();
  for (const tab of [
    "users",
    "listings",
    "requests",
    "reports",
    "emails",
    "audit",
  ]) {
    const rows = data[tab];
    assert.deepEqual(
      rows.filter((x) => ids.includes(x.id)).map((x) => x.id),
      ids,
      tab + " fixture order",
    );
    for (let i = 1; i < rows.length; i++)
      assert.ok(
        +new Date(rows[i - 1].createdAt) >= +new Date(rows[i].createdAt),
        tab + " descending timestamps",
      );
  }
  console.log(
    "PASS: actual admin API queries return users, listings, requests, reports, emails and audit newest first, despite reverse insertion order.",
  );
} finally {
  for (const model of [
    "problemReport",
    "rentalRequest",
    "listing",
    "email",
    "adminAudit",
  ])
    await db[model].deleteMany({ where: { id: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
}
