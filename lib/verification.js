import { randomBytes } from "node:crypto";
import { db } from "./db.js";
import { sendEmail } from "./email.js";
import { emailConfigured } from "./mail-provider.mjs";
import {
  generateCode,
  codeDigest,
  codeEmail,
  OTP_SUBJECT,
  OTP_TTL,
  OTP_COOLDOWN,
} from "./otp.mjs";
import { fail, hash, limit } from "./security.js";
import { authLog } from "./auth-log.mjs";
export const otpEmailId = (challenge) => `otp-${hash(challenge)}`;
export async function requestVerification(
  email,
  {
    store = db,
    send = sendEmail,
    configured = emailConfigured(),
    preview = false,
    ip,
  } = {},
) {
  if (!configured && !preview)
    fail(
      "Email verification is temporarily unavailable. Please try again shortly.",
      503,
    );
  if (ip) await limit(`otp-ip:${ip}`, 60, 15 * 60000, store);
  await limit("otp-request:global", 100, 60000, store);
  const code = generateCode(),
    challenge = randomBytes(24).toString("hex"),
    now = new Date();
  const digest = codeDigest(email, challenge, code);
  const issued = await store.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1::int AS locked FROM pg_advisory_xact_lock(hashtext(${email})::bigint)`;
    const previous = await tx.emailOtp.findUnique({ where: { email } });
    if (previous && previous.resendAt > now) return null;
    // Count actual sends, not repeated clicks blocked by the cooldown.
    await limit(`otp-request:${email}`, 5, 15 * 60000, tx);
    const data = {
      challenge,
      digest,
      expiresAt: new Date(+now + OTP_TTL),
      resendAt: new Date(+now + OTP_COOLDOWN),
      attempts: 0,
    };
    await tx.emailOtp.upsert({
      where: { email },
      create: { email, ...data },
      update: data,
    });
    return { previous, data };
  });
  if (!issued) {
    authLog("rate_limit_triggered", { reason: "resend_cooldown" });
    fail("Please wait 60 seconds before requesting another code.", 429);
  }
  let delivery;
  try {
    delivery = await send(email, OTP_SUBJECT, codeEmail(code), {
      id: otpEmailId(challenge),
    });
  } catch {
    authLog("verification_send_failed", { reason: "outbox_or_provider_error" });
  }
  const accepted =
    ["Accepted", "Delivered"].includes(delivery?.deliveryStatus) ||
    (preview && !configured && delivery?.deliveryStatus === "Queued");
  if (!accepted) {
    // Keep a previously issued, still-valid code usable after a failed resend.
    const old = issued.previous;
    const data =
      old && old.expiresAt > now
        ? {
            challenge: old.challenge,
            digest: old.digest,
            expiresAt: old.expiresAt,
            attempts: old.attempts,
            resendAt: issued.data.resendAt,
          }
        : { expiresAt: now };
    await store.emailOtp.updateMany({ where: { email, challenge }, data });
    fail(
      "We couldn't send your verification code. Please wait a minute, then try again. If you already have a valid code, you can still use it.",
      503,
    );
  }
  return {
    ok: true,
    challenge,
    expiresAt: issued.data.expiresAt.toISOString(),
    resendAt: issued.data.resendAt.toISOString(),
    ...(preview ? { previewCode: code } : {}),
  };
}
