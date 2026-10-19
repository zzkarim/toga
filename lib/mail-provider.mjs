import { smtpDiagnostic } from "./email-status.mjs";
import nodemailer from "nodemailer";
import { createHash } from "node:crypto";
export function emailConfigured(env = process.env) {
  return (
    env.EMAIL_PROVIDER === "gmail" &&
    env.GMAIL_USER === "jointoga@gmail.com" &&
    /^[a-zA-Z]{16}$/.test(env.GMAIL_APP_PASSWORD || "")
  );
}
export function gmailTransport(env = process.env) {
  if (!emailConfigured(env)) throw new Error("Gmail SMTP is not configured.");
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: env.GMAIL_USER, pass: env.GMAIL_APP_PASSWORD },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    disableFileAccess: true,
    disableUrlAccess: true,
    logger: false,
    debug: false,
  });
}
const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function mailContent(record) {
  if (/[\r\n]/.test(record.subject)) throw new Error("Invalid email subject.");
  return {
    from: { name: "Toga", address: "jointoga@gmail.com" },
    to: { address: record.to },
    replyTo: "jointoga@gmail.com",
    envelope: { from: "jointoga@gmail.com", to: record.to },
    subject: record.subject,
    text: record.text,
    html: `<!doctype html><html lang="en"><body>${escapeHtml(record.text).replace(/\n/g, "<br>")}</body></html>`,
    messageId: `<toga.${createHash("sha256").update(record.id).digest("hex")}@gmail.com>`,
    disableFileAccess: true,
    disableUrlAccess: true,
  };
}
// Provider boundary: callers and the outbox do not know SMTP, credentials or provider APIs.
export async function sendMailMessage(record, { transport } = {}) {
  if (!transport && !emailConfigured())
    return {
      deliveryStatus: "Failed",
      error: "Email service is not configured.",
    };
  const client = transport || gmailTransport();
  try {
    const result = await client.sendMail(mailContent(record));
    if (!result.accepted?.length)
      return {
        deliveryStatus: "Failed",
        error: "The mail server rejected the recipient.",
      };
    return {
      deliveryStatus: "Accepted",
      sentAt: new Date(),
      providerMessageId: result.messageId,
      error: null,
    };
  } catch (error) {
    const diagnostic = smtpDiagnostic(error);
    const suffix = diagnostic ? ` (${diagnostic})` : "";
    // Only explicit SMTP rejection is safe to retry. A lost final response may follow acceptance.
    if (error.responseCode >= 400 && error.responseCode < 500)
      return {
        deliveryStatus: "Retry",
        error: `The mail server temporarily rejected this message${suffix}.`,
      };
    if (error.code === "EAUTH" || error.responseCode >= 500)
      return {
        deliveryStatus: "Failed",
        error: `Gmail rejected the message${suffix}. Check account configuration and sending limits.`,
      };
    return {
      deliveryStatus: "Unknown",
      providerMessageId: mailContent(record).messageId,
      error: `Email delivery outcome is unknown after a connection error${suffix}. Check the sender mailbox before resending.`,
    };
  } finally {
    client.close?.();
  }
}
