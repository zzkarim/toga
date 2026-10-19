import { redirect } from "next/navigation";
import Marketplace from "../components/marketplace";
import { pageUser } from "../lib/page-session";
import { needsAcceptance } from "../lib/legal.mjs";
import { needsProfile } from "../lib/profile.mjs";
export default async function Home() {
  const user = await pageUser();
  if (needsAcceptance(user)) redirect("/accept-terms");
  if (needsProfile(user)) redirect("/complete-profile");
  return <Marketplace />;
}
