import test from "node:test";
import assert from "node:assert/strict";
import {
  listingSize,
  sizeFields,
  sizeValue,
  standardSizes,
} from "../lib/sizing.mjs";
import {
  normalizePhone,
  displayPhone,
  needsProfile,
  afterAuthentication,
  adminUserName,
} from "../lib/profile.mjs";
import { TERMS_VERSION, PRIVACY_VERSION } from "../lib/legal.mjs";
const complete = {
  email: "jointoga@gmail.com",
  name: "Toga founder",
  phone: "4045551234",
  termsAcceptedAt: new Date(),
  ageConfirmedAt: new Date(),
  termsVersion: TERMS_VERSION,
  privacyVersion: PRIVACY_VERSION,
};
test("size editor preserves old and custom readable values", () => {
  for (const value of [
    "M",
    "XXS",
    "One size",
    "W32 × L30",
    "6",
    "9.5",
    "Women's 6",
    "Men's 40R",
    "30x32",
    "Youth L",
  ])
    assert.equal(sizeValue(sizeFields(value)), value);
  assert.ok(standardSizes.includes("XXS"));
  assert.equal(sizeValue({ type: "Shoes", value: "10.5" }), "10.5");
  assert.equal(
    sizeValue({ type: "Pants", waist: "32", inseam: "30" }),
    "W32 × L30",
  );
  assert.equal(listingSize(" M "), "M");
});
test("size validation rejects missing, invalid and excessive input", () => {
  for (const value of [null, 6, "", "  ", "a".repeat(41), "M\nL"])
    assert.throws(() => listingSize(value));
  for (const fields of [
    { type: "Pants", waist: "32", inseam: "" },
    { type: "Pants", waist: "0", inseam: "30" },
    { type: "Shoes", value: "shoe" },
    { type: "Numeric", value: "-1" },
  ])
    assert.throws(() => sizeValue(fields));
});
test("phone normalization accepts familiar US formats and explicit international numbers", () => {
  for (const value of [
    "4045551234",
    "(404) 555-1234",
    "+1 404 555 1234",
    "1-404-555-1234",
  ])
    assert.equal(normalizePhone(value), "+14045551234");
  assert.equal(displayPhone("+14045551234"), "(404) 555-1234");
  assert.equal(normalizePhone("+44 20 7946 0958"), "+442079460958");
  for (const value of [
    "",
    "5551234",
    "123",
    "4045551234 extension 5",
    "++14045551234",
    "+04045551234",
  ])
    assert.equal(normalizePhone(value), null);
});
test("onboarding routes incomplete users without locking out a complete admin", () => {
  assert.equal(needsProfile(null), false);
  assert.equal(afterAuthentication(complete), "/?view=browse");
  for (const patch of [{ name: "" }, { name: " " }, { phone: "" }]) {
    assert.equal(needsProfile({ ...complete, ...patch }), true);
    assert.equal(
      afterAuthentication({ ...complete, ...patch }),
      "/complete-profile",
    );
  }
  assert.equal(
    afterAuthentication({ ...complete, termsAcceptedAt: null }),
    "/accept-terms",
  );
  assert.equal(
    afterAuthentication(complete, "https://bad.example"),
    "/?view=browse",
  );
  assert.equal(adminUserName({ name: "" }), "Name not provided");
  assert.equal(adminUserName({ name: " Jordan " }), "Jordan");
});
