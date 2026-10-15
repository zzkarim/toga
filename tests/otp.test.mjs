import test from "node:test";
import assert from "node:assert/strict";
import {
  generateCode,
  codeDigest,
  codeMatches,
  codeEmail,
} from "../lib/otp.mjs";
process.env.CRON_SECRET = "unit-test-only-secret-at-least-32-characters";
test("OTP generation, keyed storage and binding", () => {
  for (let i = 0; i < 100; i++) assert.match(generateCode(), /^\d{6}$/);
  const digest = codeDigest("a@gatech.edu", "challenge", "012345");
  assert.ok(codeMatches("a@gatech.edu", "challenge", "012345", digest));
  assert.equal(
    codeMatches("b@gatech.edu", "challenge", "012345", digest),
    false,
  );
  assert.equal(codeMatches("a@gatech.edu", "other", "012345", digest), false);
  assert.equal(
    codeMatches("a@gatech.edu", "challenge", "12345", digest),
    false,
  );
  assert.notEqual(digest, "012345");
  assert.doesNotMatch(codeEmail("012345"), /https?:|<img|<a /);
});
