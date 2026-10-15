import test from "node:test";
import assert from "node:assert/strict";
import { dateRange, transition } from "../lib/rules.mjs";
test("only the lender can accept or decline a pending request", () => {
  assert.deepEqual(transition("Pending", "accept", "lender"), {
    requestStatus: "Confirmed",
    listingStatus: "Requested",
  });
  assert.throws(() => transition("Pending", "accept", "renter"));
  assert.throws(() => transition("Completed", "accept", "lender"));
});
test("pickup and return are renter-only and restore availability", () => {
  assert.equal(
    transition("Confirmed", "pickup", "renter").listingStatus,
    "Rented Out",
  );
  assert.deepEqual(transition("Active Rental", "return", "renter"), {
    requestStatus: "Completed",
    listingStatus: "Active",
  });
  assert.throws(() => transition("Active Rental", "return", "lender"));
  assert.throws(() => transition("Pending", "return", "renter"));
});
test("decline reopens a listing", () =>
  assert.equal(
    transition("Pending", "decline", "lender").listingStatus,
    "Active",
  ));
test("dates reject past, reversed, invalid, and excessive ranges", () => {
  const now = new Date("2026-09-29T12:00:00Z");
  assert.equal(
    dateRange("2026-09-29", "2026-09-30", now).endDate.toISOString(),
    "2026-09-30T00:00:00.000Z",
  );
  for (const [a, b] of [
    ["2026-09-28", "2026-09-30"],
    ["2026-09-30", "2026-09-29"],
    ["x", "y"],
    ["2026-09-29", "2027-01-01"],
  ])
    assert.throws(() => dateRange(a, b, now));
});
