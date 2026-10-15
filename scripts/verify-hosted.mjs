import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import { randomBytes, createHash } from "node:crypto";
import { storePhoto, deletePhoto } from "../lib/storage.mjs";
import assert from "node:assert/strict";
const base = process.env.APP_URL;
if (!base?.startsWith("https://") || !process.env.DIRECT_URL)
  throw new Error("Configure the hosted environment first.");
const db = new PrismaClient(),
  id = `deployment-check-${Date.now()}`,
  photo = randomBytes(16).toString("hex"),
  token = randomBytes(32).toString("hex");
const headers = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  ? {
      "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
    }
  : {};
try {
  assert.equal((await fetch(base + "/api/health", { headers })).status, 200);
  const html = await (await fetch(base, { headers })).text();
  assert.match(html, /<title>Toga<\/title>/);
  assert.match(html, /Peer-to-peer clothing rentals for college students/);
  const config = await (await fetch(base + "/api/config", { headers })).json();
  assert.equal(config.domain, "gatech.edu");
  const rejected = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: { ...headers, Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({ email: "check@example.com" }),
  });
  assert.equal(rejected.status, 400);
  await db.user.create({
    data: {
      id,
      email: `${id}@gatech.edu`,
      name: "Temporary deployment check",
      phone: "4045550100",
    },
  });
  await db.session.create({
    data: {
      id: createHash("sha256").update(token).digest("hex"),
      userId: id,
      expiresAt: new Date(Date.now() + 300000),
    },
  });
  const auth = { ...headers, Cookie: `toga_session=${token}` };
  const me = await (await fetch(base + "/api/me", { headers: auth })).json();
  assert.equal(me.user.id, id);
  await storePhoto(
    photo,
    await sharp({
      create: { width: 10, height: 10, channels: 3, background: "#7A2E2E" },
    })
      .webp()
      .toBuffer(),
  );
  await db.upload.create({ data: { id: photo, ownerId: id } });
  assert.equal(
    (await fetch(`${base}/api/photos/${photo}`, { headers: auth })).status,
    200,
  );
  assert.equal(
    (await fetch(`${base}/api/photos/${photo}`, { headers })).status,
    401,
  );
  console.log(
    "Hosted smoke checks passed: Vercel routing, Supabase Postgres/session reads, Supabase Storage, private photo access, and domain rejection.",
  );
  console.log(
    "Still required before launch: real email delivery and the complete two-student rental flow on the hosted app. This smoke check does not replace those checks.",
  );
} finally {
  await db.upload.deleteMany({ where: { id: photo } });
  await db.user.deleteMany({ where: { id } });
  await deletePhoto(photo).catch(() => {});
  await db.$disconnect();
}
