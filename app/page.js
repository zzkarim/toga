import { needsAccountSecurity } from "../lib/auth-policy.mjs";
import { requireEmailVerification } from "../lib/auth-policy.mjs";
import { redirect } from "next/navigation";
import Marketplace from "../components/marketplace";
import { pageUser } from "../lib/page-session";
import { needsAcceptance } from "../lib/legal.mjs";
import { needsProfile } from "../lib/profile.mjs";
export const metadata = {
  alternates: { canonical: "/" },
  openGraph: { title: "Toga", url: "/", type: "website" },
};
export default async function Home() {
  const user = await pageUser();
  if (needsAccountSecurity(user)) redirect("/secure-account");
  if (needsAcceptance(user)) redirect("/accept-terms");
  if (needsProfile(user)) redirect("/complete-profile");
  return <Marketplace requireEmailVerification={requireEmailVerification()} />;
}
