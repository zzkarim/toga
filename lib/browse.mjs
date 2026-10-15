export const sizes = ["XS", "S", "M", "L", "XL", "XXL", "One size"];
export function filterListings(
  listings,
  {
    category = "All pieces",
    size = "All sizes",
    maxPrice = "",
    query = "",
    saved = null,
  } = {},
) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return listings
    .filter((item) => {
      const searchable =
        `${item.title} ${item.description} ${item.category}`.toLowerCase();
      return (
        (category === "All pieces" || item.category === category) &&
        (size === "All sizes" || item.size === size) &&
        (maxPrice === "" ||
          (Number.isFinite(Number(maxPrice)) &&
            item.price <= Number(maxPrice))) &&
        words.every((word) => searchable.includes(word)) &&
        (saved === null || saved.includes(item.id))
      );
    })
    .sort(
      (a, b) =>
        +new Date(b.createdAt) - +new Date(a.createdAt) ||
        b.id.localeCompare(a.id),
    );
}
export function rentalTotal(price, start, end) {
  const days = (+new Date(end) - +new Date(start)) / 86400000 + 1;
  return Number.isInteger(days) && days > 0 && days <= 31
    ? { days, total: Math.round(price * days * 100) / 100 }
    : null;
}
