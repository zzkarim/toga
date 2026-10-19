import { needsAccountSecurity } from "../../lib/auth-policy.mjs";
import { redirect } from "next/navigation";
import { pageUser } from "../../lib/page-session";
import { needsAcceptance } from "../../lib/legal.mjs";
import { needsProfile } from "../../lib/profile.mjs";
import CompleteProfile from "../../components/complete-profile";
export default async function Page() {
  const user = await pageUser();
  if (needsAccountSecurity(user)) redirect("/secure-account");
  if (!user) redirect("/");
  if (needsAcceptance(user)) redirect("/accept-terms");
  if (!needsProfile(user)) redirect("/?view=browse");
  return <CompleteProfile name={user.name || ""} phone={user.phone || ""} />;
}
