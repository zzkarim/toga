import { db } from "./db.js";
import {
  ADMIN_EXCEPTION_EMAIL,
  normalizeEmail,
  isAllowedEmail,
  DOMAIN_ERROR,
} from "./campus.mjs";
import { fail, limit } from "./security.js";
import { validPassword, hashPassword } from "./passwords.mjs";
import { requireEmailVerification } from "./auth-policy.mjs";
export async function signupWithPassword(
  body,
  { store = db, ip, verificationRequired = requireEmailVerification() } = {},
) {
  if (verificationRequired)
    fail("Please use email verification to create your account.", 409);
  const email = normalizeEmail(body.email);
  if (!isAllowedEmail(email)) fail(DOMAIN_ERROR);
  if (!validPassword(body.password))
    fail("Use a password between 12 and 128 characters.");
  if (body.password !== body.confirmPassword) fail("Passwords do not match.");
  if (ip) await limit(`signup-ip:${ip}`, 30, 3600000, store);
  await limit(`signup:${email}`, 5, 15 * 60000, store);
  await limit("signup:global", 60, 3600000, store);
  // Never upsert credentials: an existing email must use login/recovery.
  if (await store.user.findUnique({ where: { email }, select: { id: true } }))
    fail(
      "An account already exists for this email. Log in or use account recovery.",
      409,
    );
  const passwordHash = await hashPassword(body.password);
  try {
    return await store.user.create({
      data: {
        email,
        passwordHash,
        role: email === ADMIN_EXCEPTION_EMAIL ? "admin" : "user",
      },
    });
  } catch (error) {
    if (error?.code === "P2002")
      fail(
        "An account already exists for this email. Log in or use account recovery.",
        409,
      );
    throw error;
  }
}
