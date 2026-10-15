import { redirect } from "next/navigation";
import { pageUser } from "../../lib/page-session";
import { needsAcceptance } from "../../lib/legal.mjs";
import AcceptTerms from "../../components/accept-terms";
export default async function Page() {
  const user = await pageUser();
  if (!user) redirect("/");
  if (!needsAcceptance(user)) redirect("/");
  return <AcceptTerms />;
}
