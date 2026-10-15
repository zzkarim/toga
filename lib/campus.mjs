export const CAMPUS = "Georgia Tech";
export const DOMAIN = "gatech.edu";
export const DOMAIN_ERROR =
  "Toga is currently only available to Georgia Tech students — sign up with your @gatech.edu email.";
export const DESCRIPTION =
  "Peer-to-peer clothing rentals for college students.";
export const normalizeEmail = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();
export const isCampusEmail = (value) =>
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@gatech\.edu$/.test(normalizeEmail(value)) &&
  normalizeEmail(value).length <= 254;
export function safeDestination(value) {
  try {
    const url = new URL(
      String(value || "/?view=browse"),
      "https://toga.invalid",
    );
    if (url.origin !== "https://toga.invalid" || url.pathname !== "/")
      return "/?view=browse";
    const view = url.searchParams.get("view");
    return [
      "browse",
      "rentals",
      "closet",
      "profile",
      "saved",
      "admin",
    ].includes(view)
      ? `/?view=${view}`
      : "/?view=browse";
  } catch {
    return "/?view=browse";
  }
}

export const ADMIN_EXCEPTION_EMAIL = "jointoga@gmail.com";
export const isAllowedEmail = (value) =>
  isCampusEmail(value) || normalizeEmail(value) === ADMIN_EXCEPTION_EMAIL;
