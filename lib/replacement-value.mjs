// Missing and explicitly zero are distinct. Reject coercions such as false or [].
export function replacementValue(value) {
  if (value == null || (typeof value === "string" && !value.trim()))
    return null;
  if (!["number", "string"].includes(typeof value))
    throw new Error("Enter a valid replacement value or leave it blank.");
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 10000)
    throw new Error(
      "Enter a replacement value between $0 and $10,000, or leave it blank.",
    );
  return Math.round(amount * 100) / 100;
}
