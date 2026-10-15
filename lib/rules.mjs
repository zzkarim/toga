export const campusToday = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
export const categories = [
  "Formal",
  "Interview/Professional",
  "Outerwear",
  "Everyday",
  "Costume",
];
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
    accept: ["Pending", "lender", "Confirmed", "Requested"],
    decline: ["Pending", "lender", "Declined", "Active"],
    cancel: ["Pending", "renter", "Cancelled", "Active"],
    pickup: ["Confirmed", "renter", "Active Rental", "Rented Out"],
    return: ["Active Rental", "renter", "Completed", "Active"],
  };
  const rule = rules[action];
  if (!rule || rule[0] !== status || rule[1] !== actor)
    throw new Error("This action is not available for this rental.");
  return { requestStatus: rule[2], listingStatus: rule[3] };
}
