import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { db } from "./db.js";
import { storePhoto, loadPhoto, deletePhoto } from "./storage.mjs";
import { fail, limit } from "./security.js";

export const MAX_INPUT_BYTES = 25 * 1024 * 1024;
export const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;
const SUPPORTED_IMAGE_FORMATS = new Set(["jpeg", "png", "webp", "heif"]);

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
export async function processImageForUpload(input) {
  if (!Buffer.isBuffer(input) || input.length === 0)
    throw new Error("We couldn't process this photo. Try choosing another image.");
  if (input.length > MAX_INPUT_BYTES)
    throw new Error("This photo is too large to process. Try another photo.");

  let metadata;
  try {
    metadata = await sharp(input, {
      limitInputPixels: 80_000_000,
      failOn: "error",
    }).metadata();
  } catch {
    throw new Error("We couldn't process this photo. Try choosing another image.");
  }
  if (!SUPPORTED_IMAGE_FORMATS.has(metadata.format))
    throw new Error("We couldn't process this photo. Try choosing another image.");

  for (const [size, quality] of [[1800, 82], [1600, 74], [1400, 68]]) {
    const { data, info } = await sharp(input, {
      limitInputPixels: 80_000_000,
      failOn: "error",
    })
      .rotate()
      .resize({
        width: size,
        height: size,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality, effort: 4 })
      .toBuffer({ resolveWithObject: true });

    if (data.length <= MAX_OUTPUT_BYTES)
      return { buffer: data, width: info.width, height: info.height };
  }
  throw new Error("We couldn't process this photo. Try choosing another image.");
}
export async function savePhoto(req, user) {
  if (Number(req.headers.get("content-length")) > MAX_INPUT_BYTES + 1024)
    fail("This photo is too large to process. Try another photo.", 413);
  await limit(`uploads:${user.id}`, 60, 3600000);
  const form = await req.formData(),
    file = form.get("file");
  if (
    !file ||
    typeof file.arrayBuffer !== "function" ||
    !file.size ||
    file.size > MAX_INPUT_BYTES
  )
    fail("This photo is too large to process. Try another photo.", 413);
  let image;
  try {
    const input = Buffer.from(await file.arrayBuffer());
    image = (await processImageForUpload(input)).buffer;
  } catch (error) {
    if (error.status) throw error;
    fail(error.message || "We couldn't process this photo. Try choosing another image.");
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
