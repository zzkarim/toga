import test from "node:test";
import assert from "node:assert/strict";
import { filterListings, rentalTotal } from "../lib/browse.mjs";
import {
  isCampusEmail,
  isAllowedEmail,
  DOMAIN_ERROR,
  safeDestination,
} from "../lib/campus.mjs";
const items = [
  {
    id: "a",
    title: "Blue formal dress",
    description: "Silk",
    category: "Formal",
    size: "S",
    price: 12,
    createdAt: "2026-09-20",
  },
  {
    id: "b",
    title: "Black formal dress",
    description: "Cotton",
    category: "Formal",
    size: "M",
    price: 20,
    createdAt: "2026-09-21",
  },
  {
    id: "c",
    title: "Interview blazer",
    description: "Wool",
    category: "Interview/Professional",
    size: "M",
    price: 15,
    createdAt: "2026-09-21",
  },
];
test("only exact Georgia Tech addresses are accepted, case-insensitively", () => {
  assert.ok(isCampusEmail(" User@GATECH.EDU "));
  for (const email of [
    "user@bu.edu",
    "user@gatech.edu.evil.com",
    "user@sub.gatech.edu",
    "user@@gatech.edu",
    "@gatech.edu",
    "user@gmail.com",
  ])
    assert.equal(isCampusEmail(email), false);
  assert.match(DOMAIN_ERROR, /@gatech.edu/);
});
test("default sort uses date descending then deterministic id descending", () =>
  assert.deepEqual(
    filterListings(items).map((x) => x.id),
    ["c", "b", "a"],
  ));
test("category, size, price, search and saved filters combine correctly", () => {
  assert.deepEqual(
    filterListings(items, {
      category: "Formal",
      size: "S",
      maxPrice: "15",
      query: "dress blue",
    }).map((x) => x.id),
    ["a"],
  );
  assert.deepEqual(
    filterListings(items, { size: "M", maxPrice: "15" }).map((x) => x.id),
    ["c"],
  );
  assert.deepEqual(
    filterListings(items, { saved: ["b"] }).map((x) => x.id),
    ["b"],
  );
  assert.equal(filterListings(items, { query: "   " }).length, 3);
  assert.equal(filterListings(items, { maxPrice: "0" }).length, 0);
  assert.equal(filterListings(items, { category: "Costume" }).length, 0);
});
test("rental quote includes both dates and preserves cents", () => {
  assert.deepEqual(rentalTotal(12.5, "2026-09-30", "2026-10-01"), {
    days: 2,
    total: 25,
  });
  assert.equal(rentalTotal(12, "2026-10-01", "2026-09-30"), null);
});
test("post-login redirects cannot leave the app", () => {
  assert.equal(safeDestination("//evil.com"), "/?view=browse");
  assert.equal(safeDestination("/?view=rentals"), "/?view=rentals");
  assert.equal(safeDestination("javascript:alert(1)"), "/?view=browse");
});

test("only the exact founder email bypasses the campus restriction", () => {
  assert.ok(isAllowedEmail(" Jointoga@GMAIL.com "));
  assert.ok(isAllowedEmail("student@gatech.edu"));
  for (const email of [
    "other@gmail.com",
    "jointoga+admin@gmail.com",
    "join.toga@gmail.com",
    "jointoga@gmail.com.evil.test",
  ])
    assert.equal(isAllowedEmail(email), false);
});
