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
  throw Error("Local, email-disabled tests only");
const db = new PrismaClient(),
  prefix = `onboard-${randomUUID()}`,
  email = `${prefix}@gatech.edu`;
let cookie = "",
  id,
  listingId,
  photo;
async function call(route, method = "GET", body, expected = 200) {
  const response = await fetch(`${base}/api/${route}`, {
    method,
    headers: {
      Origin: base,
      Cookie: cookie,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  assert.equal(response.status, expected, `${route}: ${JSON.stringify(data)}`);
  if (response.headers.get("set-cookie"))
    cookie = response.headers.get("set-cookie").split(";")[0];
  return data;
}
async function redirect(path, destination) {
  const r = await fetch(base + path, {
    headers: { Cookie: cookie },
    redirect: "manual",
  });
  assert.equal(r.status, 307);
  assert.equal(r.headers.get("location"), destination);
}
try {
  const challenge = await call("auth/otp/request", "POST", { email });
  assert.equal(
    (
      await call("auth/otp/verify", "POST", {
        email,
        challenge: challenge.challenge,
        code: challenge.previewCode,
      })
    ).next,
    "/accept-terms",
  );
  id = (await call("me")).user.id;
  await call("legal/accept", "POST", {
    accepted: true,
    termsVersion: TERMS_VERSION,
    privacyVersion: PRIVACY_VERSION,
  });
  await redirect("/", "/complete-profile");
  assert.equal(
    (await fetch(base + "/complete-profile", { headers: { Cookie: cookie } }))
      .status,
    200,
  );
  const sessionId = createHash("sha256")
    .update(cookie.split("=")[1])
    .digest("hex");
  for (const body of [
    { name: "", phone: "4045551234" },
    { name: "Jordan", phone: "" },
    { name: "Jordan", phone: "123" },
  ])
    await call("me", "PATCH", body, 400);
  await call("listings", "POST", {}, 400);
  await call("requests", "POST", {}, 400);
  // Existing optional values survive the minimal onboarding PATCH.
  await db.user.update({
    where: { id },
    data: {
      paymentInfo: "Cash",
      classYear: 2028,
      profilePhotoUrl: "/preserve-existing-photo",
    },
  });
  const saved = (
    await call("me", "PATCH", { name: "Jordan", phone: "(404) 555-1234" })
  ).user;
  assert.equal(saved.phone, "+14045551234");
  assert.equal(saved.paymentInfo, "Cash");
  assert.equal(saved.classYear, 2028);
  assert.equal(saved.profilePhotoUrl, "/preserve-existing-photo");
  assert.ok(await db.session.findUnique({ where: { id: sessionId } }));
  await redirect("/complete-profile", "/?view=browse");
  assert.equal(
    (
      await fetch(base + "/", {
        headers: { Cookie: cookie },
        redirect: "manual",
      })
    ).status,
    200,
  );
  await call("me", "PATCH", {
    name: "Jordan",
    phone: "4045551234",
    paymentInfo: "",
  });
  assert.equal((await call("me")).user.paymentInfo, null);
  const fd = new FormData();
  fd.set(
    "file",
    new Blob(
      [
        await sharp({
          create: { width: 32, height: 32, channels: 3, background: "#7a2e2e" },
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
    headers: { Origin: base, Cookie: cookie },
    body: fd,
  });
  assert.equal(upload.status, 200);
  photo = (await upload.json()).url;
  const body = {
    title: "Local sizing check",
    description: "Disposable sizing fixture",
    categories: ["Everyday", "Custom"],
    customCategory: " Streetwear ",
    size: "M",
    condition: "Good",
    price: 5,
    photos: [photo],
    lenderConfirmed: true,
  };
  const created = await call("listings", "POST", body);
  listingId = created.listing.id;
  assert.equal(created.listing.customCategory, "Streetwear");
  await call(
    `listings/${listingId}`,
    "PATCH",
    { ...body, customCategory: "" },
    400,
  );
  await call(`listings/${listingId}`, "PATCH", {
    ...body,
    customCategory: "Vintage",
  });
  assert.equal(
    (await call("listings?mine=true")).listings.find((x) => x.id === listingId)
      .customCategory,
    "Vintage",
  );
  await call(`listings/${listingId}`, "PATCH", {
    ...body,
    categories: ["Everyday"],
    customCategory: "",
  });
  assert.equal(
    (await call("listings?mine=true")).listings.find((x) => x.id === listingId)
      .customCategory,
    null,
  );

  for (const size of [
    "M",
    "XXS",
    "W32 × L30",
    "6",
    "10.5",
    "Men's 40R",
    "Youth L",
  ]) {
    await call(`listings/${listingId}`, "PATCH", { ...body, size });
    assert.equal(
      (await call("listings?mine=true")).listings.find(
        (x) => x.id === listingId,
      ).size,
      size,
    );
  }
  await call(`listings/${listingId}`, "PATCH", { ...body, size: "" }, 400);
  await db.user.update({ where: { id }, data: { phone: "" } }); // An existing incomplete session gets the same gate.
  await redirect("/", "/complete-profile");
  assert.equal((await call("me")).user.id, id);
  await call("requests", "POST", {}, 400);
  await call("auth/logout", "POST", {});
  assert.equal((await call("me")).user, null);
  console.log(
    "PASS: OTP to legal/profile completion; existing incomplete session; complete bypass; required fields; normalized phone; optional fields preserved; no session reset; server gates; create/edit/read all sizes.",
  );
} finally {
  if (listingId) await db.listing.deleteMany({ where: { id: listingId } });
  if (id) {
    for (const upload of await db.upload.findMany({ where: { ownerId: id } }))
      await deletePhoto(upload.id);
    await db.upload.deleteMany({ where: { ownerId: id } });
  }
  if (id) await db.user.deleteMany({ where: { id } });
  await db.email.deleteMany({ where: { to: email } });
  await db.emailOtp.deleteMany({ where: { email } });
  await db.rateLimit.deleteMany({
    where: {
      id: {
        in: ["otp-request:", "otp-verify:"].map((p) =>
          createHash("sha256")
            .update(p + email)
            .digest("hex"),
        ),
      },
    },
  });
  await db.$disconnect();
}
