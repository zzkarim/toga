// Curated, admin-owned inspiration only. No real rental records are used.
export const HALLOWEEN_EXAMPLES = [
  {
    key: "racing-jacket",
    title: "Racing Jacket",
    size: "M",
    price: 8,
    categories: ["Costume", "Outerwear"],
    description:
      "A red racing jacket could make an easy racecar driver costume.",
  },
  {
    key: "soccer-jersey",
    title: "Soccer Jersey",
    size: "L",
    price: 5,
    categories: ["Costume", "Everyday"],
    description:
      "A jersey and shorts are an easy soccer player costume. You might already have both.",
  },
  {
    key: "black-dress",
    title: "Black Dress",
    size: "S",
    price: 6,
    categories: ["Costume", "Formal"],
    description:
      "A simple black dress can be the base for lots of Halloween costumes.",
  },
  {
    key: "leather-jacket",
    title: "Leather Jacket",
    size: "M",
    price: 10,
    categories: ["Costume", "Outerwear"],
    description:
      "A leather jacket could work for a biker costume or finish off a Halloween outfit.",
  },
  {
    key: "western-shirt",
    title: "Western Shirt",
    size: "L",
    price: 5,
    categories: ["Costume", "Everyday"],
    description: "A western shirt with jeans makes a simple cowboy costume.",
  },
  {
    key: "black-blazer",
    title: "Black Blazer",
    size: "M",
    price: 8,
    categories: ["Costume", "Formal", "Professional"],
    description:
      "Pair a black blazer with a tie and sunglasses for a Men in Black costume.",
  },
];
export const demoId = (key) => `toga-halloween-example-2026-${key}`;
export const DEMO_IDS = HALLOWEEN_EXAMPLES.map((item) => demoId(item.key));
export const demoBrowseWhere = {
  OR: [
    { isDemo: false },
    {
      isDemo: true,
      id: { in: DEMO_IDS },
      owner: { email: "jointoga@gmail.com" },
    },
  ],
};
export function demoRanges(listing) {
  return listing.isDemo && DEMO_IDS.includes(listing.id)
    ? [{ start: "2026-10-29", end: "2026-11-01" }]
    : [];
}
