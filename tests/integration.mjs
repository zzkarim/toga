import {TERMS_VERSION, PRIVACY_VERSION} from "../lib/legal.mjs";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import { randomBytes, createHash } from "node:crypto";
import { deletePhoto } from "../lib/storage.mjs";
const db = new PrismaClient(),
  base = process.env.TEST_URL || "http://127.0.0.1:3000";
if (
  !["localhost", "127.0.0.1"].includes(new URL(base).hostname) ||
  (process.env.SENDGRID_API_KEY || (process.env.GMAIL_APP_PASSWORD || process.env.RESEND_API_KEY))
)
  throw new Error(
    "This disposable integration suite runs only locally with real email disabled.",
  );
const prefix = `test-${Date.now()}`,
  cookies = {},
  users = [],
  items = [],
  uploads = [];
const hash = (s) => createHash("sha256").update(s).digest("hex");
async function call(
  route,
  method = "GET",
  body,
  actor,
  status = 200,
  extra = {},
) {
  if (route === "requests" && method === "POST" && body) body = {...body, renterAcknowledged:true, termsVersion:TERMS_VERSION, replacementValue:(await db.listing.findUnique({where:{id:body.listingId}}))?.retailValue};
  const res = await fetch(base + "/api/" + route, {
    method,
    redirect: "manual",
    headers: {
      Origin: process.env.APP_URL || base,
      "Content-Type": "application/json",
      ...(actor ? { Cookie: cookies[actor] } : {}),
      ...extra,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  assert.equal(
    res.status,
    status,
    `${method} ${route}: ${JSON.stringify(data)}`,
  );
  return data;
}
async function login(actor) {
  const email = `${prefix}-${actor}@gatech.edu`;
  const { preview } = await call("auth/login", "POST", {
    email,
    next: "/?view=rentals",
  });
  assert.ok(preview);
  const token = new URL(preview).searchParams.get("token");
  // Simply opening a link cannot consume it (mail security scanners commonly do this).
  assert.equal((await fetch(base + new URL(preview).search)).status, 200);
  const res = await fetch(base + "/api/auth/verify", {
    method: "POST",
    headers: {
      Origin: process.env.APP_URL || base,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token, next: "//evil.test" }),
  });
  assert.equal(res.status, 200);
  cookies[actor] = res.headers.get("set-cookie").split(";")[0];
  const { user } = await call("me", "GET", null, actor);
  users.push(user.id);
  await call("legal/accept", "POST", {accepted:true,termsVersion:TERMS_VERSION,privacyVersion:PRIVACY_VERSION}, actor);
  await call(
    "me",
    "PATCH",
    { name: `Test ${actor}`, phone: "+1 404 555 0111" },
    actor,
  );
  await call("auth/verify", "POST", { token }, actor, 400);
  return user.id;
}
async function photo(actor) {
  const bytes = await sharp({
    create: { width: 80, height: 100, channels: 3, background: "#7A2E2E" },
  })
    .png()
    .toBuffer();
  const data = new FormData();
  data.append("file", new Blob([bytes], { type: "image/png" }), "photo.png");
  const res = await fetch(base + "/api/upload", {
    method: "POST",
    headers: { Origin: process.env.APP_URL || base, Cookie: cookies[actor] },
    body: data,
  });
  assert.equal(res.status, 200, await res.clone().text());
  const { url } = await res.json();
  uploads.push(url.split("/").at(-1));
  return url;
}
async function jobs() {
  return call("jobs", "POST", {}, null, 200, {
    Authorization: `Bearer ${process.env.CRON_SECRET}`,
  });
}
async function assertAdminEvent(event, id) {
  for (let attempt = 0; attempt < 30; attempt++) {
    if (await db.email.count({ where: { id: `admin-${event}-${id}` } })) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(
    await db.email.count({ where: { id: `admin-${event}-${id}` } }),
    1,
    `expected one admin ${event} email for ${id}`,
  );
}
try {
  const response = await fetch(base),
    html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /Peer-to-peer clothing rentals for college students\./);
  assert.match(html, /<title>Toga<\/title>/);
  assert.doesNotMatch(
    html,
    /images\.unsplash|Newest first|toga\.<\/span>|Good style/,
  );
  assert.equal((await call("config")).domain, "gatech.edu");
  for (const email of ["a@bu.edu", "a@gmail.com", "a@gatech.edu.evil.test"])
    assert.match(
      (await call("auth/login", "POST", { email }, null, 400)).error,
      /Georgia Tech/,
    );
  await call("listings", "GET", null, null, 401);
  const lender = await login("lender"),
    renter = await login("renter"),
    other = await login("other");
  await call("admin", "GET", null, "renter", 403);
  const image = await photo("lender");
  assert.equal(
    (await fetch(base + image, { headers: { Cookie: cookies.lender } })).status,
    200,
  );
  assert.equal(
    (await fetch(base + image, { headers: { Cookie: cookies.other } })).status,
    404,
  );
  assert.equal((await fetch(base + image)).status, 401);
  const bad = new FormData();
  bad.append(
    "file",
    new Blob(["<svg/>"], { type: "image/svg+xml" }),
    "bad.svg",
  );
  assert.equal(
    (
      await fetch(base + "/api/upload", {
        method: "POST",
        headers: {
          Origin: process.env.APP_URL || base,
          Cookie: cookies.lender,
        },
        body: bad,
      })
    ).status,
    400,
  );
  const data = {
    lenderConfirmed: true,
    title: "Test blazer",
    description: "Wool blazer",
    category: "Interview/Professional",
    size: "M",
    condition: "Good",
    price: 12.5,
    photos: [image],
  };
  const { listing } = await call(
    "listings",
    "POST",
    { ...data, status: "Draft" },
    "lender",
  );
  items.push(listing.id);
  assert.equal(listing.status, "Active");
  assert.equal(listing.retailValue, null);
  await call("listings", "POST", data, "renter", 400);
  await call(
    `listings/${listing.id}`,
    "PATCH",
    { ...data, retailValue: 200 },
    "lender",
  );
  assert.equal(
    Boolean((await db.listing.findUnique({ where: { id: listing.id } })).lenderConfirmedAt),
    true,
  );
  await call(`listings/${listing.id}`, "PATCH", data, "renter", 404);
  const list = (await call("listings", "GET", null, "renter")).listings;
  assert.equal(list[0].owner.phone, undefined);
  assert.equal(list[0].owner.email, undefined);
  assert.equal(
    (await fetch(base + image, { headers: { Cookie: cookies.renter } })).status,
    200,
  );
  const start = new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    end = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
    request = { listingId: listing.id, startDate: start, endDate: end, renterAcknowledged:true, termsVersion:TERMS_VERSION, replacementValue:200 };
  await call("requests", "POST", request, "lender", 400);
  const races = await Promise.all(
    ["renter", "other"].map((actor) =>
      fetch(base + "/api/requests", {
        method: "POST",
        headers: {
          Origin: process.env.APP_URL || base,
          "Content-Type": "application/json",
          Cookie: cookies[actor],
        },
        body: JSON.stringify(request),
      }),
    ),
  );
  assert.deepEqual(races.map((r) => r.status).sort(), [200, 400]);
  let pending = await db.rentalRequest.findFirst({
    where: { listingId: listing.id, status: "Pending" },
  });
  await call(`requests/${pending.id}/decline`, "POST", {}, "lender");
  await assertAdminEvent("request", pending.id);
  await assertAdminEvent("decline", pending.id);
  assert.ok(await db.email.findUnique({ where: { id: `request-${pending.id}-pending` } }));
  assert.ok(await db.email.findUnique({ where: { id: `request-${pending.id}-decline` } }));
  await call("requests", "POST", request, "renter");
  let r = (await call("requests", "GET", null, "renter")).requests.find(
    (x) => x.status === "Pending",
  );
  assert.equal(r.partner.phone, undefined);
  assert.equal(r.pricePerDay, data.price);
  await call(`listings/${listing.id}`, "DELETE", null, "lender", 400);
  await call(`requests/${r.id}/accept`, "POST", {}, "renter", 400);
  await call(`requests/${r.id}/accept`, "POST", {}, "lender");
  await assertAdminEvent("request", r.id);
  await assertAdminEvent("accept", r.id);
  assert.ok(await db.email.findUnique({ where: { id: `request-${r.id}-pending` } }));
  assert.ok(await db.email.findUnique({ where: { id: `request-${r.id}-accept` } }));
  assert.ok(
    (await call("requests", "GET", null, "renter")).requests.find(
      (x) => x.id === r.id,
    ).partner.phone,
  );
  await db.rentalRequest.update({
    where: { id: r.id },
    data: { startDate: new Date(Date.now() + 3600000) },
  });
  await Promise.all([jobs(), jobs()]);
  assert.equal(
    await db.email.count({
      where: { to: { startsWith: prefix }, subject: {endsWith: ": pickup reminder on Toga"} },
    }),
    2,
  );
  await call(`requests/${r.id}/pickup`, "POST", {}, "lender", 400);
  await call(`requests/${r.id}/pickup`, "POST", {}, "renter");
  await assertAdminEvent("pickup", r.id);
  const privatePhoto = await photo("renter");
  await call(
    `requests/${r.id}/condition`,
    "POST",
    { stage: "Pickup", photoUrl: privatePhoto },
    "renter",
  );
  assert.equal(
    (await fetch(base + privatePhoto, { headers: { Cookie: cookies.lender } }))
      .status,
    200,
  );
  assert.equal(
    (await fetch(base + privatePhoto, { headers: { Cookie: cookies.other } }))
      .status,
    404,
  );
  await db.rentalRequest.update({
    where: { id: r.id },
    data: { endDate: new Date(Date.now() + 3600000) },
  });
  await Promise.all([jobs(), jobs()]);
  assert.equal(
    await db.email.count({
      where: { to: { startsWith: prefix }, subject: {endsWith: ": return reminder on Toga"} },
    }),
    2,
  );
  await call(`requests/${r.id}/return`, "POST", {}, "renter");
  await assertAdminEvent("return", r.id);
  await call(
    `listings/${listing.id}`,
    "PATCH",
    { ...data, price: data.price + 5 },
    "lender",
  );
  assert.equal(
    (await db.rentalRequest.findUnique({ where: { id: r.id } })).pricePerDay,
    data.price,
  );
  await call(`requests/${r.id}/rating`, "POST", { score: 5 }, "renter");
  await call(`requests/${r.id}/rating`, "POST", { score: 4 }, "renter");
  assert.equal(await db.rating.count({ where: { requestId: r.id } }), 1);
  assert.equal((await call("me", "GET", null, "lender")).user.rating, 4);
  await call(
    `requests/${r.id}/report`,
    "POST",
    { description: "A test condition report." },
    "renter",
  );
  const report = await db.problemReport.findFirst({
    where: { requestId: r.id, reporterId: renter },
  });
  await assertAdminEvent("report", report.id);
  assert.equal(
    (await call("requests", "GET", null, "lender")).requests.find(
      (x) => x.id === r.id,
    ).reports.length,
    0,
  );
  await db.user.update({ where: { id: lender }, data: { role: "admin" } });
  assert.ok(
    (await call("admin", "GET", null, "lender")).reports.find(
      (x) => x.requestId === r.id,
    ),
  );
  await call("requests", "POST", request, "renter");
  pending = await db.rentalRequest.findFirst({
    where: { listingId: listing.id, status: "Pending" },
  });
  await call(`requests/${pending.id}/cancel`, "POST", {}, "renter");
  await assertAdminEvent("cancel", pending.id);
  assert.equal(
    (await db.listing.findUnique({ where: { id: listing.id } })).status,
    "Active",
  );
  await call("requests", "POST", request, "renter");
  pending = await db.rentalRequest.findFirst({
    where: { listingId: listing.id, status: "Pending" },
  });
  await db.rentalRequest.update({
    where: { id: pending.id },
    data: { createdAt: new Date(Date.now() - 49 * 3600000) },
  });
  await jobs();
  await assertAdminEvent("expired", pending.id);
  assert.equal(
    (await db.rentalRequest.findUnique({ where: { id: pending.id } })).status,
    "Expired",
  );
  await call(`listings/${listing.id}`, "DELETE", null, "lender");
  assert.equal(
    (await call("listings?mine=true", "GET", null, "lender")).listings.some(
      (x) => x.id === listing.id,
    ),
    false,
  );
  await call("jobs", "POST", {}, "renter", 401);
  await call("jobs", "GET", null, "renter", 401);
  await call("jobs", "GET", null, null, 200, {Authorization: `Bearer ${process.env.CRON_SECRET}`});
  await call(
    "me",
    "PATCH",
    { name: "Attack", phone: "123456789" },
    "renter",
    403,
    { Origin: "https://evil.test" },
  );
  const legacy = await db.user.create({
    data: { email: `${prefix}@bu.edu`, name: "Legacy", phone: "123456789" },
  });
  users.push(legacy.id);
  const session = randomBytes(32).toString("hex");
  await db.session.create({
    data: {
      id: hash(session),
      userId: legacy.id,
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  cookies.legacy = `toga_session=${session}`;
  assert.equal((await call("me", "GET", null, "legacy")).user, null);
  await call("auth/logout", "POST", {}, "renter");
  assert.equal((await call("me", "GET", null, "renter")).user, null);
  const rateEmail = `${prefix}-limit@gatech.edu`;
  for (let i = 0; i < 5; i++)
    await call("auth/login", "POST", { email: rateEmail });
  await call("auth/login", "POST", { email: rateEmail }, null, 429);
  console.log(
    "PASS: Postgres lifecycle, exact-domain auth, scanner-safe links, auto-active listings, private uploads, concurrent reservations/reminders, ratings, reports, incoming/outgoing authorization, cancellation, expiry, rate limits, CSRF, logout, and legacy-session rejection.",
  );
} finally {
  const requests = await db.rentalRequest.findMany({
      where: { listingId: { in: items } },
    }),
    ids = requests.map((x) => x.id);
  await db.rating.deleteMany({ where: { requestId: { in: ids } } });
  await db.problemReport.deleteMany({ where: { requestId: { in: ids } } });
  await db.conditionCheck.deleteMany({ where: { requestId: { in: ids } } });
  await db.rentalRequest.deleteMany({ where: { id: { in: ids } } });
  await db.listing.deleteMany({ where: { id: { in: items } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.loginToken.deleteMany({ where: { email: { startsWith: prefix } } });
  await db.email.deleteMany({ where: { to: { startsWith: prefix } } });
  await db.upload.deleteMany({ where: { id: { in: uploads } } });
  for (const id of uploads) await deletePhoto(id).catch(() => {});
  await db.$disconnect();
}
