import test from "node:test";
import assert from "node:assert/strict";
import { resendContent, sendMailMessage } from "../lib/mail-provider.mjs";
import { needsAccountSecurity } from "../lib/auth-policy.mjs";
import { mayApplyStatus, reconcileResendEvents } from "../lib/resend-events.js";
const env = { EMAIL_PROVIDER: "resend", RESEND_API_KEY: "mock-only" };
const record = {
  id: "unit-message",
  provider: "resend",
  to: "fixture@gatech.edu",
  subject: "Your Toga verification code",
  text: "Plain text <safe>\nOpen Toga.",
};
test("Resend uses authenticated senders, reply-to, escaped HTML and plain text", () => {
  const auth = resendContent(record),
    notice = resendContent({
      ...record,
      subject: "Jordan requested your blazer on Toga",
    });
  assert.equal(auth.from, "Toga <login@jointoga.com>");
  assert.equal(notice.from, "Toga <notifications@jointoga.com>");
  assert.equal(auth.reply_to, "jointoga@gmail.com");
  assert.equal(auth.text, record.text);
  assert.match(auth.html, /&lt;safe&gt;/);
  assert.doesNotMatch(auth.html, /<img|<a |style=|tracking/i);
});
test("Resend acceptance is not delivery; stable idempotency key and single provider", async () => {
  let calls = 0;
  const fetcher = async (url, options) => {
    calls++;
    assert.equal(url, "https://api.resend.com/emails");
    assert.equal(options.headers["Idempotency-Key"], "toga-unit-message");
    return { ok: true, json: async () => ({ id: "provider-id" }) };
  };
  const result = await sendMailMessage(record, { env, fetcher });
  assert.equal(result.deliveryStatus, "Accepted");
  assert.equal(result.providerMessageId, "provider-id");
  assert.equal(calls, 1);
  const blocked = await sendMailMessage(
    { ...record, provider: "gmail" },
    { env, fetcher },
  );
  assert.equal(blocked.deliveryStatus, "Failed");
  assert.equal(calls, 1);
  const rollback = await sendMailMessage(record, {
    env: { EMAIL_PROVIDER: "gmail" },
    fetcher,
  });
  assert.equal(rollback.deliveryStatus, "Failed");
  assert.equal(calls, 1);
});
test("Resend failures remain bounded and never disclose provider responses or credentials", async () => {
  for (const [status, expected] of [
    [400, "Failed"],
    [401, "Failed"],
    [429, "Retry"],
    [503, "Retry"],
  ]) {
    const result = await sendMailMessage(record, {
      env,
      fetcher: async () => ({
        ok: false,
        status,
        json: async () => ({ message: "private provider detail" }),
      }),
    });
    assert.equal(result.deliveryStatus, expected);
    assert.doesNotMatch(result.error, /private|mock-only/);
  }
  assert.equal(
    (
      await sendMailMessage(record, {
        env,
        fetcher: async () => {
          throw Error("private");
        },
      })
    ).deliveryStatus,
    "Unknown",
  );
});
test("verified-account gate preserves admin fallback and requires both student credentials", () => {
  for (const verified of [false, true])
    for (const password of [false, true]) {
      assert.equal(
        needsAccountSecurity(
          {
            email: "fixture@gatech.edu",
            emailVerifiedAt: verified ? new Date() : null,
            passwordHash: password ? "hash" : null,
          },
          { ENFORCE_VERIFIED_ACCOUNTS: "true" },
        ),
        !(verified && password),
      );
    }
  assert.equal(
    needsAccountSecurity(
      { email: "jointoga@gmail.com", passwordHash: "hash" },
      { ENFORCE_VERIFIED_ACCOUNTS: "true" },
    ),
    false,
  );
  assert.equal(
    needsAccountSecurity({ email: "fixture@gatech.edu" }, {}),
    false,
  );
});
test("webhook reconciliation handles early events, replay, and late delivery after bounce", async () => {
  const events = [
    { id: "1", type: "email.delivered", occurredAt: new Date(1) },
    { id: "2", type: "email.bounced", occurredAt: new Date(2) },
    { id: "3", type: "email.delivered", occurredAt: new Date(3) },
  ];
  let message = null;
  const store = {
    emailDeliveryEvent: { findMany: async () => events },
    email: {
      findMany: async () => (message ? [message] : []),
      updateMany: async ({ where, data }) => {
        if (message.deliveryStatus === where.deliveryStatus)
          Object.assign(message, data);
      },
    },
  };
  await reconcileResendEvents("provider-id", store);
  message = { id: "local", deliveryStatus: "Accepted" };
  await reconcileResendEvents("provider-id", store);
  assert.equal(message.deliveryStatus, "Bounced");
  await reconcileResendEvents("provider-id", store);
  assert.equal(message.deliveryStatus, "Bounced");
  assert.equal(mayApplyStatus("Complained", "Delivered"), false);
  assert.equal(mayApplyStatus("Bounced", "Complained"), true);
});
