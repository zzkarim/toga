import { DatabaseSync } from "node:sqlite";
import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { isCampusEmail, normalizeEmail } from "../lib/campus.mjs";
import { storePhoto } from "../lib/storage.mjs";
const source = process.env.SQLITE_SOURCE || "prisma/dev.db";
const sqlite = new DatabaseSync(source, { readOnly: true });
const table = (name) => {
  try {
    return sqlite
      .prepare(`SELECT * FROM "${name}"`)
      .all()
      .map((row) => {
        for (const key of ["createdAt", "startDate", "endDate"])
          if (row[key] != null) row[key] = new Date(row[key]);
        return row;
      });
  } catch (error) {
    if (String(error.message).includes("no such table")) return [];
    throw error;
  }
};
const demoIds = new Set(["maya", "james", "sofia", "founder"]);
const allUsers = table("User");
const users = allUsers.filter(
  (u) =>
    isCampusEmail(u.email) && !demoIds.has(u.id) && !u.id.startsWith("demo-"),
);
const userIds = new Set(users.map((u) => u.id));
const listings = table("Listing").filter(
  (l) => userIds.has(l.ownerId) && !l.isDemo,
);
const listingIds = new Set(listings.map((l) => l.id));
const requests = table("RentalRequest").filter(
  (r) =>
    listingIds.has(r.listingId) &&
    userIds.has(r.lenderId) &&
    userIds.has(r.renterId),
);
const requestIds = new Set(requests.map((r) => r.id));
const ratings = table("Rating").filter(
  (r) =>
    requestIds.has(r.requestId) &&
    userIds.has(r.raterId) &&
    userIds.has(r.ratedUserId),
);
const reports = table("ProblemReport").filter(
  (r) => requestIds.has(r.requestId) && userIds.has(r.reporterId),
);
const checks = table("ConditionCheck").filter(
  (r) => requestIds.has(r.requestId) && userIds.has(r.userId),
);
console.log(
  JSON.stringify(
    {
      mode: process.argv.includes("--apply") ? "apply" : "dry-run",
      users: users.length,
      excludedUsers: allUsers.length - users.length,
      listings: listings.length,
      requests: requests.length,
      ratings: ratings.length,
      reports: reports.length,
      conditionChecks: checks.length,
    },
    null,
    2,
  ),
);
if (!process.argv.includes("--apply")) {
  console.log(
    "Source unchanged. Review counts, then rerun with --apply against an empty Postgres target. Sessions, sign-in tokens, and email records are intentionally not imported.",
  );
  sqlite.close();
  process.exit(0);
}
const db = new PrismaClient();
try {
  if ((await db.user.count()) || (await db.listing.count()))
    throw new Error(
      "Import requires an empty target. Refusing to overwrite existing data.",
    );
  const uploads = [],
    converted = new Map();
  async function convert(url, ownerId) {
    if (!url) return null;
    const key = `${ownerId}:${url}`;
    if (converted.has(key)) return converted.get(key);
    let bytes;
    const old = /^\/uploads\/([a-f0-9]+\.(?:jpg|png|webp))$/.exec(url),
      recent = /^\/api\/photos\/([a-f0-9]{32})$/.exec(url);
    if (old) bytes = await readFile(path.join("public/uploads", old[1]));
    else if (recent)
      bytes = await readFile(
        path.join(
          process.env.SQLITE_UPLOAD_DIR || "data/uploads",
          `${recent[1]}.webp`,
        ),
      );
    else
      throw new Error(
        "A non-demo record has an unsupported photo URL. Replace that photo before importing.",
      );
    const image = await sharp(bytes, { limitInputPixels: 40000000 })
      .rotate()
      .resize({
        width: 1800,
        height: 1800,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();
    const id = randomBytes(16).toString("hex");
    await storePhoto(id, image);
    uploads.push({ id, ownerId });
    const newUrl = `/api/photos/${id}`;
    converted.set(key, newUrl);
    return newUrl;
  }
  for (const user of users) {
    user.email = normalizeEmail(user.email);
    user.paymentInfo ??= user.venmoHandle ? `Venmo: @${user.venmoHandle.replace(/^@/, "")}` : null;
    delete user.venmoHandle;
    user.role =
      user.email === normalizeEmail(process.env.ADMIN_EMAIL) ? "admin" : "user";
    user.profilePhotoUrl = await convert(user.profilePhotoUrl, user.id);
  }
  for (const listing of listings) {
    listing.photos = JSON.stringify(
      await Promise.all(
        JSON.parse(listing.photos).map((url) => convert(url, listing.ownerId)),
      ),
    );
    listing.highValue = Boolean(listing.highValue);
    listing.isDemo = false;
  }
  for (const request of requests) {
    request.pricePerDay =
      request.pricePerDay ??
      listings.find((l) => l.id === request.listingId).price;
    request.pickupReminderSent = Boolean(request.pickupReminderSent);
    request.returnReminderSent = Boolean(request.returnReminderSent);
  }
  for (const report of reports)
    report.photoUrl = await convert(report.photoUrl, report.reporterId);
  for (const check of checks)
    check.photoUrl = await convert(check.photoUrl, check.userId);
  await db.$transaction(
    async (tx) => {
      for (const [model, records] of [
        ["user", users],
        ["upload", uploads],
        ["listing", listings],
        ["rentalRequest", requests],
        ["rating", ratings],
        ["problemReport", reports],
        ["conditionCheck", checks],
      ])
        if (records.length) await tx[model].createMany({ data: records });
    },
    { timeout: 60000 },
  );
  console.log(
    "Import committed. SQLite source was not modified. Verify record counts and run the hosted smoke test before opening the waitlist.",
  );
} finally {
  sqlite.close();
  await db.$disconnect();
}
