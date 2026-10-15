import {
  legalPublicationProblems,
  CONTACT_EMAIL,
} from "../../lib/legal-config.mjs";
import { redirect } from "next/navigation";
import { pageUser } from "../../lib/page-session";
import { needsAcceptance } from "../../lib/legal.mjs";
import AcceptTerms from "../../components/accept-terms";
export default async function Page() {
  const user = await pageUser();
  if (!user) redirect("/");
  if (!needsAcceptance(user)) redirect("/");
  const draft = legalPublicationProblems().length > 0;
  if (process.env.NODE_ENV === "production" && draft)
    return (
      <main className="legal-document">
        <h1>Publication review pending</h1>
        <p>
          Marketplace access will resume after the legal documents are
          finalized. Contact {CONTACT_EMAIL} for assistance.
        </p>
      </main>
    );
  return <AcceptTerms draft={draft} />;
}
