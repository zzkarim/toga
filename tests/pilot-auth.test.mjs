import test from "node:test";
import assert from "node:assert/strict";
import { requireEmailVerification } from "../lib/auth-policy.mjs";
import {
  buildAdminAuthEmail,
  notifyAdminOfAuthEvent,
  buildAdminMarketplaceEmail,
} from "../lib/admin-notifications.mjs";
import { signupWithPassword } from "../lib/password-signup.js";
import { verifyPassword } from "../lib/passwords.mjs";
test("pilot mode requires an explicit false; verified mode remains restorable", () => {
  assert.equal(requireEmailVerification({}), true);
  assert.equal(
    requireEmailVerification({ REQUIRE_EMAIL_VERIFICATION: "true" }),
    true,
  );
  assert.equal(
    requireEmailVerification({ REQUIRE_EMAIL_VERIFICATION: "false" }),
    false,
  );
});
test("password signup validates campus/confirmation and hashes credentials without email verification", async () => {
  let created;
  const store = {
    $queryRaw: async () => [{ count: 1 }],
    user: {
      findUnique: async () => null,
      create: async ({ data }) => {
        created = data;
        return { id: "test", ...data };
      },
    },
  };
  const body = {
    email: "Student@GATECH.EDU",
    password: "local test password 123",
    confirmPassword: "local test password 123",
  };
  await assert.rejects(
    signupWithPassword(body, { store, verificationRequired: true }),
    (e) => e.status === 409,
  );
  for (const invalid of [
    { ...body, email: "student@gmail.com" },
    { ...body, password: "short" },
    { ...body, confirmPassword: "different" },
  ])
    await assert.rejects(
      signupWithPassword(invalid, { store, verificationRequired: false }),
      (e) => e.status === 400,
    );
  await signupWithPassword(body, { store, verificationRequired: false });
  assert.equal(created.email, "student@gatech.edu");
  assert.notEqual(created.passwordHash, body.password);
  assert.ok(await verifyPassword(body.password, created.passwordHash));
  assert.equal(created.emailVerified, undefined);
  assert.equal(created.role, "user");
  await signupWithPassword(
    { ...body, email: "jointoga@gmail.com" },
    { store, verificationRequired: false },
  );
  assert.equal(created.role, "admin");
});
test("existing accounts and uniqueness conflicts cannot replace credentials", async () => {
  const body = {
    email: "existing@gatech.edu",
    password: "local password 123",
    confirmPassword: "local password 123",
  };
  for (const existing of [true, false]) {
    const store = {
      $queryRaw: async () => [{ count: 1 }],
      user: {
        findUnique: async () => (existing ? { id: "existing" } : null),
        create: async () => {
          throw { code: "P2002" };
        },
      },
    };
    await assert.rejects(
      signupWithPassword(body, { store, verificationRequired: false }),
      (e) => e.status === 409,
    );
  }
});
test("admin auth events are minimal, uniquely keyed, and fail-soft for every provider outcome", async () => {
  const user = {
    id: "user-test",
    email: "test@gatech.edu",
    name: "Test",
    password: "never-share",
    passwordHash: "never-share",
    sessionToken: "never-share",
  };
  for (const event of ["signup", "login"]) {
    const details = {
      event,
      user,
      eventId: "event-one",
      occurredAt: "2026-10-19T00:00:00Z",
    };
    const mail = buildAdminAuthEmail(details);
    assert.doesNotMatch(mail.text, /never-share|password|token|IP address/i);
    assert.match(mail.text, /test@gatech.edu/);
    let key;
    assert.equal(
      await notifyAdminOfAuthEvent(
        details,
        async (to, subject, text, options) => {
          assert.equal(to, "jointoga@gmail.com");
          key = options.id;
          return { deliveryStatus: "Accepted" };
        },
      ),
      true,
    );
    assert.equal(
      key,
      event === "signup" ? "admin-signup-user-test" : "admin-login-event-one",
    );
    for (const deliveryStatus of ["Failed", "Unknown", "Retry", "Bounced"])
      assert.equal(
        await notifyAdminOfAuthEvent(details, async () => ({ deliveryStatus })),
        false,
      );
    assert.equal(
      await notifyAdminOfAuthEvent(details, async () => {
        throw Error("provider unavailable");
      }),
      false,
    );
  }
});
test("accepted rental admin copy provides coordination details without authentication secrets", () => {
  const mail = buildAdminMarketplaceEmail({
    event: "accept",
    renterPhone: "4045550100",
    lenderPhone: "4045550101",
    paymentInfo: "Cash at pickup",
  });
  assert.match(mail.text, /4045550100/);
  assert.match(mail.text, /4045550101/);
  assert.match(mail.text, /Cash at pickup/);
});
