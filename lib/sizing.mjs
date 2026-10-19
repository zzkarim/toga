export const standardSizes = [
  "XXS",
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "One size",
];
export function listingSize(value) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.trim().length > 40 ||
    /[\u0000-\u001f\u007f]/.test(value)
  )
    throw new Error("Enter a size using 1–40 characters.");
  return value.trim();
}
export function sizeFields(value = "M") {
  if (standardSizes.includes(value)) return { type: "Standard", value };
  const pants = /^W(\d+(?:\.\d+)?) × L(\d+(?:\.\d+)?)$/.exec(value);
  if (pants) return { type: "Pants", waist: pants[1], inseam: pants[2] };
  if (/^\d+(?:\.\d+)?$/.test(value)) return { type: "Numeric", value };
  return { type: "Custom", value };
}
export function sizeValue(fields) {
  if (fields.type === "Pants") {
    for (const value of [fields.waist, fields.inseam]) {
      if (
        !/^\d+(?:\.\d+)?$/.test(value || "") ||
        Number(value) < 1 ||
        Number(value) > 100
      )
        throw new Error("Enter a waist and inseam between 1 and 100 inches.");
    }
    return `W${fields.waist} × L${fields.inseam}`;
  }
  if (
    ["Numeric", "Shoes"].includes(fields.type) &&
    (!/^\d+(?:\.\d+)?$/.test(fields.value || "") || Number(fields.value) > 100)
  )
    throw new Error("Enter a numeric size between 0 and 100.");
  if (fields.type === "Standard" && !standardSizes.includes(fields.value))
    throw new Error("Choose a size.");
  return listingSize(fields.value);
}
