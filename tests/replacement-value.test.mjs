import test from "node:test";
import assert from "node:assert/strict";
import { replacementValue } from "../lib/replacement-value.mjs";
import { legalPublicationProblems } from "../lib/legal-config.mjs";
test("optional replacement value distinguishes missing, zero, and invalid input", () => {
  for (const value of [null, undefined, "", "  "])
    assert.equal(replacementValue(value), null);
  for (const value of [0, "0", "0.00"])
    assert.equal(replacementValue(value), 0);
  assert.equal(replacementValue("23.456"), 23.46);
  for (const value of [false, true, [], {}, -1, Infinity, "no", 10001])
    assert.throws(() => replacementValue(value));
});
test("draft status remains explicit until operator, jurisdiction, and review are provided", () => {
  assert.equal(legalPublicationProblems({}).length, 3);
  const env = {
    LEGAL_OPERATOR_NAME: "Test operator",
    LEGAL_GOVERNING_JURISDICTION: "Test jurisdiction",
    LEGAL_REVIEW_APPROVED: "true",
  };
  assert.deepEqual(legalPublicationProblems(env), []);
  assert.ok(
    legalPublicationProblems({ ...env, LEGAL_OPERATOR_NAME: "[OPERATOR]" })
      .length,
  );
});
