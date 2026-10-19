export const AUTH_SUBJECTS = [
  "Your Toga verification code",
  "Your Toga sign-in link",
];
export const isAuthEmail = (subject) => AUTH_SUBJECTS.includes(subject);
export const emailStatusLabel = (value) =>
  value === "Accepted"
    ? "Provider accepted (delivery unconfirmed)"
    : value === "Sending"
      ? "Sending to provider"
      : value;
export const emailType = (subject) =>
  isAuthEmail(subject)
    ? "Verification / sign-in"
    : subject.startsWith("Toga Admin")
      ? "Admin copy"
      : "Rental notification";
export function smtpDiagnostic(error) {
  const code = Number(error.responseCode);
  const enhanced = String(error.response || "").match(
    /\b[245]\.\d{1,3}\.\d{1,3}\b/,
  )?.[0];
  return [
    Number.isInteger(code) && code >= 400 && code < 600 ? `SMTP ${code}` : null,
    enhanced,
    ["EAUTH", "ETIMEDOUT", "ECONNRESET", "ECONNECTION", "EDNS"].includes(
      error.code,
    )
      ? error.code
      : null,
  ]
    .filter(Boolean)
    .join("; ");
}
