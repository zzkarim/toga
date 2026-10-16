import { cookies } from "next/headers";
import { db } from "./db";
import { hash } from "./security";
import { isAllowedEmail } from "./campus.mjs";
// Read-only server-page gate. API requests retain existing rolling session renewal.
export async function pageUser() {
  const token = (await cookies()).get("toga_session")?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { id: hash(token) },
    include: { user: true },
  });
  return session &&
    session.expiresAt > new Date() &&
    isAllowedEmail(session.user.email) &&
    session.user.accountStatus === "Active"
    ? session.user
    : null;
}
