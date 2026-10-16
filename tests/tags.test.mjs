import test from "node:test";
import assert from "node:assert/strict";
import { listingTags, browseCategories, categories } from "../lib/rules.mjs";
import { filterListings } from "../lib/browse.mjs";
test("optional tags validate zero, one, multiple and legacy inputs", () => {
  assert.deepEqual(listingTags({}), []);
  assert.deepEqual(listingTags({ categories: [] }), []);
  assert.deepEqual(listingTags({ categories: ["Costume"] }), ["Costume"]);
  assert.deepEqual(
    listingTags({ categories: ["Formal", "Professional", "Formal"] }),
    ["Formal", "Professional"],
  );
  assert.deepEqual(listingTags({ category: "Interview/Professional" }), [
    "Professional",
  ]);
  for (const value of [null, "Formal", ["obsolete"], [{}]])
    assert.throws(() => listingTags({ categories: value }));
  assert.deepEqual(categories, [
    "Costume",
    "Formal",
    "Professional",
    "Outerwear",
    "Everyday",
    "Custom",
  ]);
  assert.equal(browseCategories.includes("Custom"), false);
});
test("membership filters include multi-tag listings, Custom and untagged appear in All pieces", () => {
  const rows = [
    [],
    ["Custom"],
    ["Custom", "Costume"],
    ["Formal", "Professional"],
  ].map((categories, i) => ({
    id: String(i),
    categories,
    title: "Item",
    description: "Test",
    size: "M",
    price: 10,
    createdAt: "2026-10-01",
  }));
  assert.equal(filterListings(rows).length, 4);
  for (const tag of ["Formal", "Professional"])
    assert.deepEqual(
      filterListings(rows, { category: tag }).map((r) => r.id),
      ["3"],
    );
  assert.deepEqual(
    filterListings(rows, { category: "Costume" }).map((r) => r.id),
    ["2"],
  );
});
