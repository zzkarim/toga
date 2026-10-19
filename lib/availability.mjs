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
