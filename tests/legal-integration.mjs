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
  process.env.GMAIL_APP_PASSWORD
)
  throw Error("Local database and disabled email required");
const db = new PrismaClient(),
  prefix = "legal-" + randomUUID(),
  ids = [prefix + "-old", prefix + "-new"],
  cookies = [];
let listingId;
async function call(route, method = "GET", body, cookie = cookies[0]) {
  const r = await fetch(base + "/api/" + route, {
    method,
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      Cookie: cookie || "",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json() };
}
const accept = {
  accepted: true,
  termsVersion: TERMS_VERSION,
  privacyVersion: PRIVACY_VERSION,
};
try {
  for (const path of ["terms", "privacy", "safety"]) {
    const r = await fetch(base + "/" + path);
    assert.equal(r.status, 200);
    assert.match(await r.text(), /DRAFT: pending attorney review/);
  }
  for (const [i, id] of ids.entries()) {
    await db.user.create({
      data: {
        id,
        email: id + "@gatech.edu",
        name: "Legal test",
        phone: "4045550100",
        ...(i === 0
          ? {
              termsVersion: "old",
              termsAcceptedAt: new Date(),
              ageConfirmedAt: new Date(),
            }
          : {}),
      },
    });
    const token = randomUUID();
    cookies.push("toga_session=" + token);
    await db.session.create({
      data: {
        id: createHash("sha256").update(token).digest("hex"),
        userId: id,
        expiresAt: new Date(Date.now() + 30 * 86400000),
      },
    });
    const page = await fetch(base + "/?view=profile", {
      headers: { Cookie: cookies[i] },
      redirect: "manual",
    });
    assert.equal(page.status, 307);
    assert.equal(page.headers.get("location"), "/accept-terms");
    for (const route of ["listings", "requests", "activity", "admin"])
      assert.equal((await call(route, "GET", null, cookies[i])).status, 428);
    assert.equal(
      (
        await call(
          "legal/accept",
          "POST",
          { ...accept, accepted: false },
          cookies[i],
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await call(
          "legal/accept",
          "POST",
          { ...accept, termsVersion: "stale" },
          cookies[i],
        )
      ).status,
      400,
    );
    assert.equal(
      (await call("legal/accept", "POST", accept, cookies[i])).status,
      200,
    );
    assert.equal((await call("listings", "GET", null, cookies[i])).status, 200);
    const user = await db.user.findUnique({ where: { id } });
    assert.equal(user.termsVersion, TERMS_VERSION);
    assert.ok(user.ageConfirmedAt);
    assert.equal(
      (
        await fetch(base + "/", {
          headers: { Cookie: cookies[i] },
          redirect: "manual",
        })
      ).status,
      200,
    );
  }
  assert.equal((await call("legal/accept", "POST", accept, "")).status, 401);
  const data = {
    title: "Legal test item",
    description: "Test only",
    category: "Formal",
    size: "M",
    condition: "Good",
    retailValue: 80,
    price: 5,
    photos: [],
  };
  const denied = await call("listings", "POST", data);
  assert.equal(denied.status, 400);
  assert.match(denied.data.error, /Confirm ownership/);
  // Existing fixture listing isolates request acknowledgement checks from image-upload tests.
  const item = await db.listing.create({
    data: { ...data, photos: "[]", ownerId: ids[0] },
  });
  listingId = item.id;
  const req = {
    listingId,
    startDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
  };
  assert.equal((await call("requests", "POST", req, cookies[1])).status, 400);
  assert.equal(
    (
      await call(
        "requests",
        "POST",
        {
          ...req,
          renterAcknowledged: true,
          termsVersion: TERMS_VERSION,
          replacementValue: 79,
        },
        cookies[1],
      )
    ).status,
    400,
  );
  assert.equal(
    (await db.listing.findUnique({ where: { id: listingId } })).status,
    "Active",
  );
  assert.equal(
    (
      await call(
        "requests",
        "POST",
        {
          ...req,
          renterAcknowledged: true,
          termsVersion: TERMS_VERSION,
          replacementValue: 80,
        },
        cookies[1],
      )
    ).status,
    200,
  );
  const rental = await db.rentalRequest.findFirst({ where: { listingId } });
  assert.ok(rental.renterAcknowledgedAt);
  assert.equal(rental.renterAcknowledgedReplacementValue, 80);
  assert.equal(rental.renterAcknowledgedTermsVersion, TERMS_VERSION);
  await db.user.update({
    where: { id: ids[1] },
    data: { privacyVersion: "old" },
  });
  assert.equal((await call("requests", "GET", null, cookies[1])).status, 428);
  console.log(
    "PASS: public legal pages, new/existing server-page and API gates, current-version acceptance, session continuity, required listing/rental checks, stale-value rejection, recorded acknowledgement, reacceptance.",
  );
} finally {
  if (listingId) {
    await db.rentalRequest.deleteMany({ where: { listingId } });
    await db.listing.deleteMany({ where: { id: listingId } });
  }
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.email.deleteMany({
    where: { to: { in: ids.map((id) => id + "@gatech.edu") } },
  });
  await db.$disconnect();
}
