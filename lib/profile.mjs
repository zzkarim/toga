import { needsAccountSecurity } from "./auth-policy.mjs";
import { needsAcceptance } from "./legal.mjs";
import { safeDestination } from "./campus.mjs";

export function normalizePhone(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!/^\+?[\d\s().-]+$/.test(raw) || raw.length > 30) return null;
  const digits = raw.replace(/\D/g, "");
  const us =
    digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (us.length === 10 && /^[2-9]\d{2}[2-9]\d{6}$/.test(us)) return `+1${us}`;
  // International numbers need an explicit country code; US numbers need no prefix.
  if (/^\+[2-9]/.test(raw) && digits.length >= 8 && digits.length <= 15)
    return `+${digits}`;
  return null;
}
export function displayPhone(value) {
  const normalized = normalizePhone(value);
  return normalized?.startsWith("+1") && normalized.length === 12
    ? `(${normalized.slice(2, 5)}) ${normalized.slice(5, 8)}-${normalized.slice(8)}`
    : value || "";
}
export function needsProfile(user) {
  return Boolean(
    user && (!(user.name?.trim().length >= 2) || !normalizePhone(user.phone)),
  );
}
export function afterAuthentication(user, next) {
  if (needsAccountSecurity(user)) return "/secure-account";
  return needsAcceptance(user)
    ? "/accept-terms"
    : needsProfile(user)
      ? "/complete-profile"
      : safeDestination(next);
}
export function adminUserName(user) {
  return user.name?.trim() || "Name not provided";
}
