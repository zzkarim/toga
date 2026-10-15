import test from "node:test";
import assert from "node:assert/strict";
import { sendThroughSendGrid, sendGridPayload } from "../lib/sendgrid.mjs";
const record = {
  id: "test-id",
  to: "test@gatech.edu",
  subject: "Your Toga sign-in link",
  text: "A private one-time link",
};
test("SendGrid uses the verified sender, Toga display name, and disables link tracking", () => {
  const payload = sendGridPayload(record, "owner@example.com");
  assert.deepEqual(payload.from, { email: "owner@example.com", name: "Toga" });
  assert.equal(payload.personalizations[0].to[0].email, "test@gatech.edu");
  assert.equal(payload.tracking_settings.click_tracking.enable, false);
});
test("202 is recorded as accepted, not claimed inbox delivery", async () => {
  const result = await sendThroughSendGrid(record, {
    key: "fake",
    sender: "owner@example.com",
    fetcher: async (url, options) => {
      assert.equal(url, "https://api.sendgrid.com/v3/mail/send");
      assert.equal(options.headers.Authorization, "Bearer fake");
      return new Response(null, {
        status: 202,
        headers: { "x-message-id": "provider-id" },
      });
    },
  });
  assert.equal(result.deliveryStatus, "Accepted");
  assert.equal(result.providerMessageId, "provider-id");
});
test("only definite rate-limit rejection is automatically retried", async () => {
  for (const [code, status] of [
    [429, "Retry"],
    [403, "Failed"],
    [500, "Unknown"],
  ]) {
    const result = await sendThroughSendGrid(record, {
      fetcher: async () => new Response(null, { status: code }),
    });
    assert.equal(result.deliveryStatus, status);
  }
});
test("ambiguous network failure is never automatically resent", async () => {
  const result = await sendThroughSendGrid(record, {
    fetcher: async () => {
      throw new Error("timeout");
    },
  });
  assert.equal(result.deliveryStatus, "Unknown");
  assert.match(result.error, /Check SendGrid/);
});
