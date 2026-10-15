import { redirect } from "next/navigation";
import Marketplace from "../components/marketplace";
import { pageUser } from "../lib/page-session";
import { needsAcceptance } from "../lib/legal.mjs";
export default async function Home() {
  const user = await pageUser();
  if (needsAcceptance(user)) redirect("/accept-terms");
  return <Marketplace />;
}
