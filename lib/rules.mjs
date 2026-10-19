export const campusToday = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
export const categories = [
  "Costume",
  "Formal",
  "Professional",
  "Outerwear",
  "Everyday",
  "Custom",
];
export const browseCategories = categories.filter((tag) => tag !== "Custom");
// Older open tabs may still submit the former single-category field.
export function listingTags(body) {
  const values =
    body.categories === undefined
      ? body.category
        ? [
            body.category === "Interview/Professional"
              ? "Professional"
              : body.category,
          ]
        : []
      : body.categories;
  if (
    !Array.isArray(values) ||
    values.length > categories.length ||
    values.some((tag) => !categories.includes(tag))
  )
    throw new Error("Choose valid clothing tags.");
  return [...new Set(values)];
}
export function customCategoryValue(tags, value) {
  if (!tags.includes("Custom")) return null;
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.trim().length > 40 ||
    /[\u0000-\u001f\u007f]/.test(value)
  )
    throw new Error(
      "Enter a custom category using 1–40 characters, or deselect Custom.",
    );
  return value.trim();
}
export function displayCategories(item) {
  return (item.categories || []).map((tag) =>
    tag === "Custom" && item.customCategory ? item.customCategory : tag,
  );
}
export function dateRange(start, end, now = new Date()) {
  const a = new Date(start + "T00:00:00.000Z"),
    b = new Date(end + "T00:00:00.000Z");
  const today = new Date(campusToday(now) + "T00:00:00.000Z");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(start) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(end) ||
    !Number.isFinite(+a) ||
    !Number.isFinite(+b) ||
    a.toISOString().slice(0, 10) !== start ||
    b.toISOString().slice(0, 10) !== end ||
    a < today ||
    b < a ||
    (b - a) / 86400000 > 30
  )
    throw new Error(
      "Choose a valid date range of up to 31 days, starting today or later.",
    );
  return { startDate: a, endDate: b };
}
export function transition(status, action, actor) {
  const rules = {
    accept: ["Pending", "lender", "Confirmed"],
    decline: ["Pending", "lender", "Declined"],
    cancel: ["Pending", "renter", "Cancelled"],
    pickup: ["Confirmed", "renter", "Active Rental"],
    return: ["Active Rental", "renter", "Completed"],
  };
  const rule = rules[action];
  if (!rule || rule[0] !== status || rule[1] !== actor)
    throw new Error("This action is not available for this rental.");
  return { requestStatus: rule[2] };
}
