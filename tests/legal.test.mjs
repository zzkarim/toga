import test from "node:test";
import assert from "node:assert/strict";
import {
  needsAcceptance,
  TERMS_VERSION,
  PRIVACY_VERSION,
  renterAcknowledgement,
} from "../lib/legal.mjs";
test("terms gate requires dated adult acceptance of both current documents", () => {
  const user = {
    termsAcceptedAt: new Date(),
    ageConfirmedAt: new Date(),
    termsVersion: TERMS_VERSION,
    privacyVersion: PRIVACY_VERSION,
  };
  assert.equal(needsAcceptance(null), false);
  assert.equal(needsAcceptance({}), true);
  assert.equal(needsAcceptance(user), false);
  for (const key of Object.keys(user))
    assert.equal(needsAcceptance({ ...user, [key]: null }), true);
  assert.equal(needsAcceptance({ ...user, termsVersion: "old" }), true);
  assert.equal(needsAcceptance({ ...user, privacyVersion: "old" }), true);
  assert.match(renterAcknowledgement(0), /\$0\.00/);
  assert.match(renterAcknowledgement(125.5), /\$125\.50/);
});
