import { randomBytes, scrypt as derive, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(derive);
const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
export const validPassword = (value) =>
  typeof value === "string" && value.length >= 12 && value.length <= 128;
export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64, options);
  return `scrypt$${salt}$${key.toString("hex")}`;
}
export async function verifyPassword(password, encoded) {
  if (typeof password !== "string" || password.length > 128) return false;
  const [scheme, salt, hash] = (encoded || "").split("$");
  const valid =
    scheme === "scrypt" &&
    /^[a-f0-9]{32}$/.test(salt || "") &&
    /^[a-f0-9]{128}$/.test(hash || "");
  const key = await scrypt(
    password,
    valid ? salt : "00000000000000000000000000000000",
    64,
    options,
  );
  return valid && timingSafeEqual(key, Buffer.from(hash, "hex"));
}
