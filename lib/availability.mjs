// Rental dates include both pickup and return days; stored as UTC date-only values.
export const BLOCKING_STATUSES = ["Pending", "Confirmed", "Active Rental"];
export const RENTABLE_LISTING_STATUSES = ["Active", "Requested", "Rented Out"];
export const UNAVAILABLE_MESSAGE =
  "Those dates are no longer available. Please choose different dates.";
export const rentalBlocksAvailability = (status) =>
  BLOCKING_STATUSES.includes(status);
export const dateOnly = (value) => new Date(value).toISOString().slice(0, 10);
export const rangesOverlap = (start, end, otherStart, otherEnd) =>
  start <= otherEnd && end >= otherStart;
export const rangeAvailable = (start, end, ranges) =>
  !ranges.some((r) => rangesOverlap(start, end, r.start, r.end));
export function selectRentalDate(selection, day, ranges = []) {
  if (!rangeAvailable(day, day, ranges))
    return { ...selection, error: "That date is unavailable." };
  if (!selection.start || !selection.choosingEnd || day < selection.start)
    return { start: day, end: day, choosingEnd: true, error: "" };
  if (!rangeAvailable(selection.start, day, ranges))
    return {
      ...selection,
      error: "Part of that date range is unavailable. Choose different dates.",
    };
  if ((new Date(day) - new Date(selection.start)) / 86400000 > 30)
    return { ...selection, error: "Choose a rental of up to 31 days." };
  return { start: selection.start, end: day, choosingEnd: false, error: "" };
}
export const blockingWhere = (now = new Date()) => ({
  OR: [
    { status: { in: BLOCKING_STATUSES.filter((s) => s !== "Pending") } },
    { status: "Pending", createdAt: { gte: new Date(+now - 48 * 3600000) } },
  ],
});
export const unavailableRanges = (requests) =>
  requests.map((r) => ({
    start: dateOnly(r.startDate),
    end: dateOnly(r.endDate),
  }));
export const OWNER_CONFLICT_MESSAGE =
  "You already have a rental/request during these dates.";
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const validDay = (d) => DAY.test(d) && dateOnly(d + "T00:00:00Z") === d;
// Owner-blocked days: sorted, merged inclusive ranges of UTC date-only strings.
export function blockedRanges(input) {
  if (input == null) return [];
  if (!Array.isArray(input) || input.length > 60)
    throw Error("Choose fewer unavailable date ranges.");
  const ranges = input.map((r) => {
    const start = r?.start,
      end = r?.end ?? r?.start;
    if (!validDay(start) || !validDay(end) || end < start)
      throw Error("Choose valid unavailable dates.");
    if ((new Date(end) - new Date(start)) / 86400000 > 365)
      throw Error("Unavailable date ranges can be up to one year.");
    return { start, end };
  });
  ranges.sort((a, b) => (a.start < b.start ? -1 : 1));
  const next = (d) => dateOnly(+new Date(d) + 86400000);
  return ranges.reduce((all, r) => {
    const last = all.at(-1);
    if (last && r.start <= next(last.end)) {
      if (r.end > last.end) last.end = r.end;
    } else all.push({ ...r });
    return all;
  }, []);
}
// Single source of renter-facing unavailability: live rentals ∪ owner blocks.
export const listingUnavailableRanges = (requests, blocked = []) => [
  ...unavailableRanges(requests),
  ...(Array.isArray(blocked) ? blocked : []),
];
