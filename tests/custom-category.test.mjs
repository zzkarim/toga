import test from "node:test";
import assert from "node:assert/strict";
import {
  customCategoryValue,
  displayCategories,
  browseCategories,
  listingTags,
} from "../lib/rules.mjs";
import { filterListings } from "../lib/browse.mjs";
import { sizeFields, sizeValue } from "../lib/sizing.mjs";
test("custom category validates selected text and clears deselected text", () => {
  assert.equal(customCategoryValue(["Custom"], "  Streetwear  "), "Streetwear");
  assert.equal(
    customCategoryValue(["Everyday", "Custom"], "Cultural attire"),
    "Cultural attire",
  );
  assert.equal(customCategoryValue(["Everyday"], ""), null);
  assert.equal(customCategoryValue([], "Old custom text"), null);
  for (const value of ["", "   ", null, "x".repeat(41), "Bad\ncategory"])
    assert.throws(() => customCategoryValue(["Custom"], value));
  assert.equal(
    customCategoryValue(["Custom"], "Women's vintage"),
    "Women's vintage",
  );
});
test("custom category displays actual text without expanding navigation or changing standard membership", () => {
  const item = {
    id: "test",
    createdAt: "2026-10-18",
    title: "Jacket",
    description: "Test",
    categories: listingTags({ categories: ["Formal", "Custom"] }),
    customCategory: "Prom",
    size: "M",
    price: 5,
  };
  assert.deepEqual(displayCategories(item), ["Formal", "Prom"]);
  assert.deepEqual(displayCategories({ categories: ["Custom"] }), ["Custom"]);
  assert.deepEqual(browseCategories, [
    "Costume",
    "Formal",
    "Professional",
    "Outerwear",
    "Everyday",
  ]);
  assert.equal(filterListings([item]).length, 1);
  assert.equal(filterListings([item], { category: "Formal" }).length, 1);
  assert.equal(filterListings([{ ...item, categories: ["Custom"] }]).length, 1);
  assert.equal(
    filterListings([{ ...item, categories: ["Custom"] }], {
      category: "Formal",
    }).length,
    0,
  );
  assert.deepEqual(
    displayCategories({ ...item, customCategory: "<b>Vintage</b>" }),
    ["Formal", "<b>Vintage</b>"],
  ); // React renders text, not markup.
});
test("custom sizes retain text on save and edit while other size formats remain compatible", () => {
  for (const value of [
    "One size",
    "Men's 40R",
    "Women's Petite M",
    "Youth L",
    "32 Short",
    "Oversized",
    "Adjustable",
    "6 Tall",
  ]) {
    assert.equal(sizeValue({ type: "Custom", value }), value);
    assert.equal(sizeValue(sizeFields(value)), value);
  }
  for (const value of ["M", "W32 × L30", "6", "9.5"])
    assert.equal(sizeValue(sizeFields(value)), value);
});
