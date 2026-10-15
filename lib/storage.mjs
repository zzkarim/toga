import path from "node:path";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
export const uploadDirectory = () =>
  path.resolve(process.env.UPLOAD_DIR || "./data/uploads");
const local = () =>
  process.env.STORAGE_DRIVER === "local" &&
  process.env.NODE_ENV !== "production";
function settings() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error("Supabase Storage is not configured.");
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "toga-photos";
  if (!/^[a-z0-9-]+$/.test(bucket)) throw new Error("Invalid storage bucket.");
  return {
    url: `${process.env.SUPABASE_URL}/storage/v1`,
    bucket,
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  };
}
export async function storePhoto(id, bytes) {
  if (!/^[a-f0-9]{32}$/.test(id)) throw new Error("Invalid photo ID.");
  if (local()) {
    await mkdir(uploadDirectory(), { recursive: true });
    await writeFile(path.join(uploadDirectory(), `${id}.webp`), bytes);
    return;
  }
  const { url, bucket, headers } = settings();
  const response = await fetch(`${url}/object/${bucket}/${id}.webp`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "image/webp", "x-upsert": "true" },
    body: bytes,
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok)
    throw new Error(`Photo storage returned ${response.status}.`);
}
export async function loadPhoto(id) {
  if (local()) return readFile(path.join(uploadDirectory(), `${id}.webp`));
  const { url, bucket, headers } = settings();
  const response = await fetch(
    `${url}/object/authenticated/${bucket}/${id}.webp`,
    { headers, signal: AbortSignal.timeout(15000), cache: "no-store" },
  );
  if (!response.ok) throw new Error("Photo unavailable.");
  return Buffer.from(await response.arrayBuffer());
}
export async function deletePhoto(id) {
  if (!/^[a-f0-9]{32}$/.test(id)) throw new Error("Invalid photo ID.");
  if (local()) {
    await unlink(path.join(uploadDirectory(), `${id}.webp`));
    return;
  }
  const { url, bucket, headers } = settings();
  const response = await fetch(`${url}/object/${bucket}`, {
    method: "DELETE",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: [`${id}.webp`] }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("Photo cleanup failed.");
}
