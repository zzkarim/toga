import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { randomUUID, createHash } from "node:crypto";
import sharp from "sharp";
import { TERMS_VERSION, PRIVACY_VERSION } from "../lib/legal.mjs";
import { deletePhoto } from "../lib/storage.mjs";
const base = process.env.TEST_URL || "http://127.0.0.1:3004";
if (
  !["localhost", "127.0.0.1"].includes(new URL(base).hostname) ||
  !["localhost", "127.0.0.1"].includes(
    new URL(process.env.DATABASE_URL).hostname,
  ) ||
  (process.env.GMAIL_APP_PASSWORD || process.env.RESEND_API_KEY)
)
  throw Error("Local-only tests");
const db = new PrismaClient(),
  ids = [],
  cookies = [],
  prefix = "polish-" + randomUUID();
let photo;
async function call(route, method = "GET", body, actor = 0, status = 200) {
  const r = await fetch(base + "/api/" + route, {
    method,
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      Cookie: cookies[actor] || "",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json();
  assert.equal(r.status, status, `${route} ${JSON.stringify(data)}`);
  return data;
}
const mod = (type, id, action, extra = {}) => ({
  targetType: type,
  targetId: id,
  action,
  note: "Disposable test moderation",
  confirm: true,
  ...extra,
});
try {
  for (let i = 0; i < 3; i++) {
    const u = await db.user.create({
      data: {
        email: `${prefix}-${i}@gatech.edu`,
        role: i === 0 ? "admin" : "user",
        termsAcceptedAt: new Date(),
        ageConfirmedAt: new Date(),
        termsVersion: TERMS_VERSION,
        privacyVersion: PRIVACY_VERSION,
      },
    });
    ids.push(u.id);
    const token = randomUUID();
    cookies.push("toga_session=" + token);
    await db.session.create({
      data: {
        id: createHash("sha256").update(token).digest("hex"),
        userId: u.id,
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
  }
  // Reproduce first-save payload: API returns null and ProfileForm spreads it unchanged.
  const fresh = (await call("me", "GET", undefined, 1)).user;
  assert.equal(fresh.paymentInfo, null);
  await call(
    "me",
    "PATCH",
    { ...fresh, name: "New student", phone: "4045550100" },
    1,
  );
  assert.equal((await call("me", "GET", undefined, 1)).user.paymentInfo, null);
  await call(
    "me",
    "PATCH",
    { name: "New student", phone: "4045550100", paymentInfo: "Cash or PayPal" },
    1,
  );
  await call("me", "PATCH", { name: "New student", phone: "4045550100" }, 1);
  assert.equal(
    (await call("me", "GET", undefined, 1)).user.paymentInfo,
    "Cash or PayPal",
  );
  await call(
    "me",
    "PATCH",
    { name: "New student", phone: "4045550100", paymentInfo: "" },
    1,
  );
  assert.equal((await call("me", "GET", undefined, 1)).user.paymentInfo, null);
  const fd = new FormData();
  fd.set(
    "file",
    new Blob(
      [
        await sharp({
          create: { width: 20, height: 20, channels: 3, background: "#7A2E2E" },
        })
          .png()
          .toBuffer(),
      ],
      { type: "image/png" },
    ),
    "test.png",
  );
  const upload = await fetch(base + "/api/upload", {
    method: "POST",
    headers: { Origin: base, Cookie: cookies[1] },
    body: fd,
  });
  assert.equal(upload.status, 200);
  photo = (await upload.json()).url;
  const draft = {
    title: "Polish test jacket",
    description: "Disposable test item",
    size: "M",
    condition: "Good",
    price: 5,
    photos: [photo],
    lenderConfirmed: true,
  };
  let listing;
  for (const tags of [
    [],
    ["Formal"],
    ["Formal", "Professional"],
    ["Custom"],
    ["Custom", "Costume"],
  ]) {
    if (!listing)
      listing = (
        await call(
          "listings",
          "POST",
          { ...draft, categories: tags, customCategory: "Test clothing" },
          1,
        )
      ).listing;
    else
      await call(
        "listings/" + listing.id,
        "PATCH",
        { ...draft, categories: tags, customCategory: "Test clothing" },
        1,
      );
    assert.deepEqual(
      (await call("listings?mine=true", "GET", undefined, 1)).listings.find(
        (x) => x.id === listing.id,
      ).categories,
      tags,
    );
  }
  await call("admin/moderate", "POST", mod("users", ids[2], "suspend"), 1, 403);
  await call("admin/moderate", "POST", mod("users", ids[0], "suspend"), 0, 400);
  await call(
    "admin/moderate",
    "POST",
    mod("listings", listing.id, "hide", { confirm: false }),
    0,
    400,
  );
  await call(
    "admin/moderate",
    "POST",
    mod("listings", listing.id, "remove"),
    0,
    400,
  );
  await call("admin/moderate", "POST", mod("listings", listing.id, "hide"));
  assert.equal(
    (await call("listings", "GET", undefined, 1)).listings.some(
      (l) => l.id === listing.id,
    ),
    false,
  );
  await call(
    "listings/" + listing.id,
    "PATCH",
    { ...draft, categories: [] },
    1,
  );
  assert.equal(
    (await db.listing.findUnique({ where: { id: listing.id } }))
      .moderationStatus,
    "Hidden",
  );
  await call("admin/moderate", "POST", mod("listings", listing.id, "restore"));
  const rental = await db.rentalRequest.create({
    data: {
      listingId: listing.id,
      lenderId: ids[1],
      renterId: ids[2],
      startDate: new Date(),
      endDate: new Date(),
      status: "Confirmed",
    },
  });
  await db.listing.update({
    where: { id: listing.id },
    data: { status: "Requested" },
  });
  await call(
    "admin/moderate",
    "POST",
    mod("users", ids[1], "close", { confirmText: "CLOSE" }),
    0,
    400,
  );
  await call(
    "admin/moderate",
    "POST",
    mod("listings", listing.id, "remove", { confirmText: "REMOVE" }),
  );
  assert.equal(
    (await db.rentalRequest.findUnique({ where: { id: rental.id } })).status,
    "Confirmed",
  );
  await call("admin/moderate", "POST", mod("requests", rental.id, "cancel"));
  await call(
    "admin/moderate",
    "POST",
    mod("requests", rental.id, "cancel"),
    0,
    400,
  );
  assert.equal(
    (await db.listing.findUnique({ where: { id: listing.id } }))
      .moderationStatus,
    "Removed",
  );
  const report = await db.problemReport.create({
    data: {
      requestId: rental.id,
      reporterId: ids[1],
      description: "Disposable report",
    },
  });
  await call(
    "admin/moderate",
    "POST",
    mod("reports", report.id, "resolve", {
      note: "Internal confidential test note",
    }),
  );
  const own = (await call("requests", "GET", undefined, 1)).requests.find(
    (r) => r.id === rental.id,
  );
  assert.equal(own.reports[0].adminNote, undefined);
  await call("admin/moderate", "POST", mod("reports", report.id, "reopen"));
  await db.rentalRequest.update({
    where: { id: rental.id },
    data: { status: "Active Rental" },
  });
  await db.listing.update({
    where: { id: listing.id },
    data: { status: "Rented Out" },
  });
  await call(
    "admin/moderate",
    "POST",
    mod("requests", rental.id, "cancel"),
    0,
    400,
  );
  await call(
    "admin/moderate",
    "POST",
    mod("requests", rental.id, "resolve"),
    0,
    400,
  );
  await call(
    "admin/moderate",
    "POST",
    mod("requests", rental.id, "resolve", { confirmText: "RETURNED" }),
  );
  await call("admin/moderate", "POST", mod("users", ids[2], "suspend"));
  assert.equal((await call("me", "GET", undefined, 2)).user, null);
  await call("admin/moderate", "POST", mod("users", ids[2], "reactivate"));
  assert.equal(await db.session.count({ where: { userId: ids[2] } }), 0);
  await call(
    "admin/moderate",
    "POST",
    mod("users", ids[2], "close", { confirmText: "CLOSE" }),
  );
  assert.equal(
    (await db.user.findUnique({ where: { id: ids[2] } })).accountStatus,
    "Closed",
  );
  assert.ok(await db.rentalRequest.findUnique({ where: { id: rental.id } }));
  assert.ok((await call("admin")).audit.some((a) => a.targetId === listing.id));
  console.log(
    "PASS: fresh null/blank/omitted payments, optional/multiple tags, moderation authorization/confirmations/history, hidden listing edit protection, rental state guards, private report notes, session revocation and audit.",
  );
} finally {
  const rentals = await db.rentalRequest.findMany({
    where: { lenderId: { in: ids } },
    select: { id: true },
  });
  const rids = rentals.map((r) => r.id);
  await db.problemReport.deleteMany({ where: { requestId: { in: rids } } });
  await db.rentalRequest.deleteMany({ where: { id: { in: rids } } });
  await db.listing.deleteMany({ where: { ownerId: { in: ids } } });
  for (const u of await db.upload.findMany({ where: { ownerId: { in: ids } } }))
    await deletePhoto(u.id);
  await db.upload.deleteMany({ where: { ownerId: { in: ids } } });
  await db.adminAudit.deleteMany({ where: { adminId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
}
