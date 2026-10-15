import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
export const OTP_TTL = 10 * 60000;
export const OTP_COOLDOWN = 60000;
export const OTP_ATTEMPTS = 5;
export const OTP_SUBJECT = "Your Toga verification code";
export const generateCode = () =>
  String(randomInt(0, 1000000)).padStart(6, "0");
export function codeDigest(email, challenge, code) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("OTP signing secret unavailable");
  return createHmac("sha256", secret)
    .update(JSON.stringify(["toga-otp-v1", email, challenge, code]))
    .digest("hex");
}
export function codeMatches(email, challenge, code, digest) {
  if (!/^\d{6}$/.test(code) || !/^[a-f0-9]{64}$/.test(digest)) return false;
  return timingSafeEqual(
    Buffer.from(codeDigest(email, challenge, code), "hex"),
    Buffer.from(digest, "hex"),
  );
}
export const codeEmail = (code) =>
  `Toga\n\nYour verification code is:\n\n${code}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this code, you can ignore this email.`;
