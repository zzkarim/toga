import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { storePhoto } from "../lib/storage.mjs";
if (
  process.env.NODE_ENV === "production" ||
  !["localhost", "127.0.0.1"].includes(
    new URL(process.env.DATABASE_URL).hostname,
  )
)
  throw new Error(
    "Demo seeding is restricted to a local development database.",
  );
const db = new PrismaClient();
try {
  for (const [id, name, role] of [
    ["demo-maya", "Demo Maya", "user"],
    ["demo-james", "Demo James", "user"],
    ["demo-admin", "Demo Admin", "admin"],
  ])
    await db.user.upsert({
      where: { id },
      update: {},
      create: {
        id,
        name,
        email: `${id}@gatech.edu`,
        phone: "4045550100",
        role,
      },
    });
  const svg =
    '<svg width="600" height="750" xmlns="http://www.w3.org/2000/svg"><rect width="600" height="750" fill="#ECE4D2"/><path d="M190 180 110 240 170 340 210 315 210 540 390 540 390 315 430 340 490 240 410 180 350 180Q300 260 250 180Z" fill="#7A2E2E"/><text x="300" y="650" font-size="22" text-anchor="middle" fill="#33201A">Demo clothing listing</text></svg>';
  for (const [id, ownerId, title, category, size, price] of [
    [
      "demo-blazer",
      "demo-maya",
      "Demo interview blazer",
      "Interview/Professional",
      "M",
      15,
    ],
    ["demo-formal", "demo-james", "Demo formal outfit", "Formal", "S", 20],
  ]) {
    const photoId = createHash("md5").update(id).digest("hex");
    await storePhoto(photoId, await sharp(Buffer.from(svg)).webp().toBuffer());
    await db.upload.upsert({
      where: { id: photoId },
      update: {},
      create: { id: photoId, ownerId },
    });
    await db.listing.upsert({
      where: { id },
      update: {},
      create: {
        id,
        ownerId,
        title,
        description:
          "An illustrated test listing, not available for real rentals.",
        category,
        categories: [
          category === "Interview/Professional" ? "Professional" : category,
        ],
        size,
        price,
        condition: "Good",
        retailValue: 0,
        photos: JSON.stringify([`/api/photos/${photoId}`]),
        status: "Active",
        isDemo: true,
      },
    });
  }
  console.log(
    "Local demo accounts created. Demo listings are excluded from the launch browse feed and cannot receive requests. Use integration tests for the complete rental flow.",
  );
} finally {
  await db.$disconnect();
}
