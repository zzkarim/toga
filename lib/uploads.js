import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { db } from "./db";
import { storePhoto, loadPhoto, deletePhoto } from "./storage.mjs";
import { fail, limit } from "./security";

export const photoId = (url) =>
  typeof url === "string" && /^\/api\/photos\/([a-f0-9]{32})$/.exec(url)?.[1];
export async function ownPhotos(urls, userId) {
  if (
    !Array.isArray(urls) ||
    urls.length > 4 ||
    urls.some((url) => !photoId(url))
  )
    fail("Please upload your photos again.");
  const owned = await db.upload.count({
    where: { id: { in: urls.map(photoId) }, ownerId: userId },
  });
  if (owned !== urls.length)
    fail("Please use photos uploaded from your account.");
}
export async function savePhoto(req, user) {
  if (Number(req.headers.get("content-length")) > 4.3 * 1024 * 1024)
    fail("Choose a photo smaller than 4 MB.", 413);
  await limit(`uploads:${user.id}`, 60, 3600000);
  const form = await req.formData(),
    file = form.get("file");
  if (
    !file ||
    typeof file.arrayBuffer !== "function" ||
    !file.size ||
    file.size > 4 * 1024 * 1024
  )
    fail("Choose a photo smaller than 4 MB.", 413);
  let image;
  try {
    const input = Buffer.from(await file.arrayBuffer());
    const processor = sharp(input, {
      limitInputPixels: 40_000_000,
      failOn: "error",
    });
    const metadata = await processor.metadata();
    if (!["jpeg", "png", "webp", "heif"].includes(metadata.format))
      fail("Please choose a JPG, PNG, WebP, or supported HEIC photo.");
    // Decode, strip metadata (including GPS), orient, and normalize to one safe format.
    image = await processor
      .rotate()
      .resize({
        width: 1800,
        height: 1800,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();
  } catch (error) {
    if (error.status) throw error;
    fail(
      "This photo could not be read. On iPhone, share or export it as a JPG, then try again.",
    );
  }
  const id = randomBytes(16).toString("hex");
  try {
    await storePhoto(id, image);
  } catch {
    fail("Photo storage is temporarily unavailable. Please try again.", 503);
  }
  try {
    await db.upload.create({ data: { id, ownerId: user.id } });
  } catch (error) {
    await deletePhoto(id).catch(() => {});
    throw error;
  }
  return { url: `/api/photos/${id}` };
}
export async function readPhoto(id, user) {
  if (!/^[a-f0-9]{32}$/.test(id)) fail("Photo not found.", 404);
  const photo = await db.upload.findUnique({ where: { id } });
  if (!photo) fail("Photo not found.", 404);
  const url = `/api/photos/${id}`;
  if (photo.ownerId !== user.id && user.role !== "admin") {
    const [listing, profile, condition, report] = await Promise.all([
      db.listing.findFirst({
        where: {
          photos: { contains: url },
          status: { in: ["Active", "Requested", "Rented Out"] },
        },
      }),
      db.user.findFirst({ where: { profilePhotoUrl: url } }),
      db.conditionCheck.findFirst({
        where: {
          photoUrl: url,
          request: { OR: [{ renterId: user.id }, { lenderId: user.id }] },
        },
      }),
      db.problemReport.findFirst({
        where: { photoUrl: url, reporterId: user.id },
      }),
    ]);
    const historic = listing
      ? null
      : await db.rentalRequest.findFirst({
          where: {
            listing: { photos: { contains: url } },
            OR: [{ renterId: user.id }, { lenderId: user.id }],
          },
        });
    if (!listing && !profile && !condition && !report && !historic)
      fail("Photo not found.", 404);
  }
  try {
    return await loadPhoto(id);
  } catch {
    fail("Photo not found.", 404);
  }
}
