export function paymentInformation(value) {
  if (value == null) return null;
  if (typeof value !== "string" || value.length > 500)
    throw new Error("Use up to 500 characters for payment information.");
  return (
    value
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
      .trim() || null
  );
}
