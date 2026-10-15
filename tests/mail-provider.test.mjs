import test from "node:test";
import assert from "node:assert/strict";
import nodemailer from "nodemailer";
import {
  mailContent,
  sendMailMessage,
  emailConfigured,
} from "../lib/mail-provider.mjs";
const record = {
  id: "test-id",
  to: "test@gatech.edu",
  subject: "Your Toga verification code",
  text: 'Your code: 123456\n<img src="https://tracker.invalid/x">',
};
test("Gmail requires exact account and server-side app password", () => {
  assert.equal(
    emailConfigured({
      EMAIL_PROVIDER: "gmail",
      GMAIL_USER: "jointoga@gmail.com",
      GMAIL_APP_PASSWORD: "abcdefghijklmnop",
    }),
    true,
  );
  assert.equal(
    emailConfigured({
      EMAIL_PROVIDER: "gmail",
      GMAIL_USER: "other@gmail.com",
      GMAIL_APP_PASSWORD: "abcdefghijklmnop",
    }),
    false,
  );
  assert.equal(emailConfigured({}), false);
});
test("MIME contains plaintext and escaped HTML, Toga sender, no tracking resources", async () => {
  const mail = mailContent(record);
  assert.deepEqual(mail.from, { name: "Toga", address: "jointoga@gmail.com" });
  assert.equal(mail.text, record.text);
  assert.match(mail.html, /&lt;img/);
  assert.doesNotMatch(mail.html, /<img|<script|<a\b/i);
  const client = nodemailer.createTransport({
    streamTransport: true,
    buffer: true,
  });
  const result = await client.sendMail(mail);
  const mime = result.message.toString();
  assert.match(mime, /multipart\/alternative/);
  assert.match(mime, /Content-Type: text\/plain/);
  assert.match(mime, /Content-Type: text\/html/);
  assert.match(mime, /From: Toga <jointoga@gmail.com>/);
  assert.throws(() =>
    mailContent({ ...record, subject: "bad\r\nBcc: other@example.com" }),
  );
});
test("SMTP acceptance is recorded, not claimed inbox delivery", async () => {
  const result = await sendMailMessage(record, {
    transport: {
      sendMail: async () => ({
        accepted: [record.to],
        messageId: "test-message",
      }),
    },
  });
  assert.equal(result.deliveryStatus, "Accepted");
  assert.ok(result.sentAt);
});
test("explicit temporary rejection retries; auth fails; ambiguous timeout never retries", async () => {
  for (const [error, status] of [
    [{ responseCode: 421 }, "Retry"],
    [{ code: "EAUTH", responseCode: 535 }, "Failed"],
    [{ code: "ETIMEDOUT", message: "secret detail" }, "Unknown"],
  ]) {
    const result = await sendMailMessage(record, {
      transport: {
        sendMail: async () => {
          throw error;
        },
      },
    });
    assert.equal(result.deliveryStatus, status);
    assert.doesNotMatch(result.error, /secret detail/);
  }
});
