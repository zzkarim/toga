import test from "node:test";
import assert from "node:assert/strict";
import {
  rentalContact,
  rentalResponseMatches,
} from "../lib/rental-contact.mjs";
const people = [
  {
    id: "A",
    name: "Renter Test",
    phone: "+14045550101",
    paymentInfo: "Renter private",
  },
  {
    id: "B",
    name: "Lender Test",
    phone: "404-555-0202",
    paymentInfo: "Venmo @lender",
  },
];
const rental = { renterId: "A", lenderId: "B", status: "Confirmed" };
test("each participant receives only the other participant; only renter receives lender payment", () => {
  for (const status of ["Confirmed", "Active Rental", "Completed"]) {
    const a = rentalContact({ ...rental, status }, "A", people),
      b = rentalContact({ ...rental, status }, "B", people);
    assert.equal(a.partner.id, "B");
    assert.equal(a.partner.phone, "+14045550202");
    assert.equal(a.partner.paymentInfo, "Venmo @lender");
    assert.equal(a.viewerRole, "renter");
    assert.equal(b.partner.id, "A");
    assert.equal(b.partner.phone, "+14045550101");
    assert.equal(b.partner.paymentInfo, undefined);
    assert.equal(b.viewerRole, "lender");
  }
});
test("private contact stays absent before acceptance and for unrelated users", () => {
  for (const status of ["Pending", "Declined", "Cancelled", "Expired"])
    for (const id of ["A", "B"]) {
      const { partner } = rentalContact({ ...rental, status }, id, people);
      assert.equal(partner.phone, undefined);
      assert.equal(partner.paymentInfo, undefined);
    }
  assert.throws(() => rentalContact(rental, "C", people));
  assert.throws(() => rentalContact({ ...rental, lenderId: "A" }, "A", people));
  assert.equal(
    rentalContact(rental, "A", [
      people[0],
      { ...people[1], phone: "javascript:bad" },
    ]).partner.phone,
    null,
  );
});
test("switching accounts in another tab cannot mix a stale viewer with fresh rental contacts", () => {
  const response = {
    viewerId: "B",
    requests: [{ ...rental, ...rentalContact(rental, "B", people) }],
  };
  assert.equal(rentalResponseMatches(response, "B"), true);
  assert.equal(rentalResponseMatches(response, "A"), false);
  assert.equal(
    rentalResponseMatches({ ...response, viewerId: "A" }, "A"),
    false,
  );
});
