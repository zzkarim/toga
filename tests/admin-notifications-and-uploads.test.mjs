import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import sharp from "sharp";

import {
  ADMIN_NOTIFICATION_EMAIL,
  buildAdminMarketplaceEmail,
  notifyAdminOfMarketplaceEvent,
} from "../lib/admin-notifications.mjs";
import {
  MAX_INPUT_BYTES,
  MAX_OUTPUT_BYTES,
  processImageForUpload,
} from "../lib/uploads.js";

const requestDetails = {
  event: "request",
  rentalId: "request-123",
  listingName: "Vintage blazer",
  renterName: "Jordan Lee",
  renterEmail: "jordan@gatech.edu",
  lenderName: "Sam Chen",
  lenderEmail: "sam@gatech.edu",
  startDate: "2026-11-01T00:00:00.000Z",
  endDate: "2026-11-04T00:00:00.000Z",
  status: "Pending",
  createdAt: "2026-10-15T12:00:00.000Z",
};

test("admin marketplace emails include useful context for every lifecycle event", () => {
  const events = [
    ["request", "New rental request"],
    ["accept", "Rental accepted"],
    ["decline", "Rental declined"],
    ["pickup", "Item picked up"],
    ["return", "Item returned"],
    ["cancel", "Rental cancelled"],
    ["expired", "Rental expired"],
    ["report", "Problem reported"],
  ];
  for (const [event, subject] of events) {
    const email = buildAdminMarketplaceEmail({
      ...requestDetails,
      event,
      reporterName: "Jordan Lee",
      reporterEmail: "jordan@gatech.edu",
      otherName: "Sam Chen",
      otherEmail: "sam@gatech.edu",
      actorName: "Jordan Lee",
      actorEmail: "jordan@gatech.edu",
      reportId: "report-456",
      reportCategory: "Rental problem",
      description: "The item was damaged.",
      reason: "Cancelled by renter",
    });
    assert.match(email.subject, new RegExp(subject));
    assert.match(email.text, /Vintage blazer/);
    assert.match(email.text, /jordan@gatech\.edu/);
    assert.match(email.text, /sam@gatech\.edu/);
    if (event !== "report") assert.match(email.text, /2026-11-01/);
    assert.doesNotMatch(email.text, /password|OTP|session id|auth token/i);
  }
  const report = buildAdminMarketplaceEmail({
    ...requestDetails,
    event: "report",
    reportId: "report-456",
    description: "The item was damaged.",
  });
  assert.match(report.text, /report-456/);
  assert.match(report.text, /The item was damaged\./);
});

test("each event produces one admin email while retry stays in the outbox", async () => {
  for (const event of ["request", "accept", "decline", "pickup", "return", "cancel", "expired", "report"]) {
    const calls = [];
    const queued = await notifyAdminOfMarketplaceEvent(
      { ...requestDetails, event },
      async (...args) => {
        calls.push(args);
        return { deliveryStatus: "Accepted" };
      },
    );
    assert.equal(queued, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], ADMIN_NOTIFICATION_EMAIL);
    assert.equal(calls[0][0], "jointoga@gmail.com");
    assert.equal(calls[0][3].id, `admin-${event}-${requestDetails.rentalId}`);
  }
});

test("repeated logical events reuse the same idempotency key", async () => {
  const ids = [];
  const send = async (_to, _subject, _text, options) => {
    ids.push(options.id);
    return { deliveryStatus: "Accepted" };
  };
  await notifyAdminOfMarketplaceEvent(requestDetails, send);
  await notifyAdminOfMarketplaceEvent(requestDetails, send);
  assert.equal(ids[0], ids[1]);
});

test("admin email failure is fail-soft", async () => {
  const result = await notifyAdminOfMarketplaceEvent(requestDetails, async () => {
    throw new Error("SMTP unavailable");
  });
  assert.equal(result, false);
});

test("server processing handles common formats, large images, and portrait orientation", async () => {
  const png = await sharp({
    create: {
      width: 1200,
      height: 1800,
      channels: 3,
      background: { r: 240, g: 30, b: 20 },
    },
  })
    .png()
    .toBuffer();
  const processedPng = await processImageForUpload(png);
  const pngMetadata = await sharp(processedPng.buffer).metadata();
  assert.equal(pngMetadata.format, "webp");
  assert.ok(processedPng.buffer.length <= MAX_OUTPUT_BYTES);
  assert.ok(pngMetadata.height > pngMetadata.width);
  assert.ok(Math.max(pngMetadata.width, pngMetadata.height) <= 1800);

  const webp = await sharp(png).webp().toBuffer();
  const processedWebp = await processImageForUpload(webp);
  assert.equal((await sharp(processedWebp.buffer).metadata()).format, "webp");

  const heif = await sharp({
    create: {
      width: 64,
      height: 96,
      channels: 3,
      background: { r: 35, g: 125, b: 90 },
    },
  })
    .heif({ compression: "av1", quality: 80 })
    .toBuffer();
  const processedHeif = await processImageForUpload(heif);
  assert.equal((await sharp(processedHeif.buffer).metadata()).format, "webp");

  const orientedJpeg = await sharp({
    create: {
      width: 160,
      height: 100,
      channels: 3,
      background: { r: 40, g: 90, b: 180 },
    },
  })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
  const processedOriented = await processImageForUpload(orientedJpeg);
  const orientedMetadata = await sharp(processedOriented.buffer).metadata();
  assert.ok(orientedMetadata.height > orientedMetadata.width);

  const noisyPixels = randomBytes(3200 * 2400 * 3);
  const largeJpeg = await sharp(noisyPixels, {
    raw: { width: 3200, height: 2400, channels: 3 },
  })
    .jpeg({ quality: 96 })
    .toBuffer();
  assert.ok(largeJpeg.length > 4 * 1024 * 1024);
  assert.ok(largeJpeg.length < MAX_INPUT_BYTES);
  const processedLarge = await processImageForUpload(largeJpeg);
  const largeMetadata = await sharp(processedLarge.buffer).metadata();
  assert.ok(processedLarge.buffer.length <= MAX_OUTPUT_BYTES);
  assert.ok(Math.max(largeMetadata.width, largeMetadata.height) <= 1800);
});

test("invalid and over-limit image inputs fail with safe messages", async () => {
  await assert.rejects(
    () => processImageForUpload(randomBytes(MAX_INPUT_BYTES + 1)),
    { message: /too large/i },
  );
  await assert.rejects(() => processImageForUpload(Buffer.from("not an image")), {
    message: /couldn't process/i,
  });
});