import test from "node:test";
import assert from "node:assert/strict";
import { paymentInformation } from "../lib/payment.mjs";
test("flexible payment instructions preserve punctuation and multiple lines", () => {
  for (const value of [
    "Venmo: @username",
    "Zelle: 404-555-1234",
    "PayPal: username",
    "Cash at pickup",
    "Cash or Venmo",
    "Cash\nor Venmo @username",
  ])
    assert.equal(paymentInformation(value), value);
  assert.equal(paymentInformation("  Cash at pickup  "), "Cash at pickup");
});
test("payment validation rejects oversized and non-text payloads", () => {
  for (const value of [{}, 42, "x".repeat(501)])
    assert.throws(() => paymentInformation(value));
  assert.equal(paymentInformation(""), null);
  assert.equal(paymentInformation("Cash\u0000"), "Cash");
});

test("new accounts may omit payment information", () => {
  for (const value of [null, undefined, "", "   "])
    assert.equal(paymentInformation(value), null);
});
