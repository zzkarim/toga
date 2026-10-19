import { needsAccountSecurity } from "../../lib/auth-policy.mjs";
import { legalPublicationProblems } from "../../lib/legal-config.mjs";
import { redirect } from "next/navigation";
import { pageUser } from "../../lib/page-session";
import { needsAcceptance } from "../../lib/legal.mjs";
import AcceptTerms from "../../components/accept-terms";
export default async function Page() {
  const user = await pageUser();
  if (needsAccountSecurity(user)) redirect("/secure-account");
  if (!user) redirect("/");
  if (!needsAcceptance(user)) redirect("/");
  const draft = legalPublicationProblems().length > 0;
  return <AcceptTerms draft={draft} />;
}
