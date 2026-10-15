// Public legal configuration. Never put secrets or an unapproved personal address here.
export { CONTACT_EMAIL } from "./contact.mjs";
export const LEGAL_OPERATOR = process.env.LEGAL_OPERATOR_NAME?.trim() || null;
export const GOVERNING_JURISDICTION =
  process.env.LEGAL_GOVERNING_JURISDICTION?.trim() || null;
export function legalPublicationProblems(env = process.env) {
  const problems = [];
  for (const key of ["LEGAL_OPERATOR_NAME", "LEGAL_GOVERNING_JURISDICTION"])
    if (
      !env[key]?.trim() ||
      /\[|\]|placeholder|todo|replace.with/i.test(env[key])
    )
      problems.push(`${key} requires an approved value.`);
  if (env.LEGAL_REVIEW_APPROVED !== "true")
    problems.push(
      "LEGAL_REVIEW_APPROVED must be true after review of the final documents and retention practices.",
    );
  return problems;
}
