import { redirect } from "next/navigation";
import { pageUser } from "../../lib/page-session";
import { afterAuthentication } from "../../lib/profile.mjs";
import SecureAccount from "../../components/secure-account";
export default async function Page({ searchParams }) {
  const user = await pageUser();
  if (!user) redirect("/");
  const reset = (await searchParams).reset === "1";
  if (user.emailVerifiedAt && user.passwordHash && !reset)
    redirect(afterAuthentication(user));
  return (
    <SecureAccount
      email={user.email}
      verified={Boolean(user.emailVerifiedAt)}
      hasPassword={Boolean(user.passwordHash)}
      reset={reset}
    />
  );
}
