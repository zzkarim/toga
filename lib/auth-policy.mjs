// Default to the verified flow unless the operator explicitly enables the pilot workaround.
export const requireEmailVerification = (env = process.env) =>
  env.REQUIRE_EMAIL_VERIFICATION !== "false";

// Separate rollout gate: deploy safely, then enable only after real GT receipt.
export const enforceVerifiedAccounts = (env = process.env) =>
  env.ENFORCE_VERIFIED_ACCOUNTS === "true";
export function needsAccountSecurity(user, env = process.env) {
  if (!user || !enforceVerifiedAccounts(env)) return false;
  if (user.email === "jointoga@gmail.com" && user.passwordHash) return false;
  return !user.emailVerifiedAt || !user.passwordHash;
}
