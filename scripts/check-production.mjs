import { legalPublicationProblems } from "../lib/legal-config.mjs";
import { isAllowedEmail } from "../lib/campus.mjs";
try {
  process.loadEnvFile(".env.production.local");
} catch {}
const problems = legalPublicationProblems();
if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(process.env.EMAIL_FROM || ""))
  problems.push(
    "EMAIL_FROM must be the exact verified sender email, without a display name.",
  );
for (const key of [
  "DATABASE_URL",
  "DIRECT_URL",
  "APP_URL",
  "ADMIN_EMAIL",
  "EMAIL_PROVIDER",
  "GMAIL_USER",
  "GMAIL_APP_PASSWORD",
  "EMAIL_FROM",
  "CRON_SECRET",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_STORAGE_BUCKET",
]) {
  if (
    !process.env[key] ||
    /YOUR_|PROJECT_REF|URL_ENCODED_PASSWORD|replace-with/i.test(
      process.env[key],
    )
  )
    problems.push(`${key} must be configured.`);
}
if (!isAllowedEmail(process.env.ADMIN_EMAIL))
  problems.push(
    "ADMIN_EMAIL must be a @gatech.edu address or jointoga@gmail.com.",
  );
if (process.env.DEV_EMAIL_PREVIEW !== "false")
  problems.push("DEV_EMAIL_PREVIEW must be false.");
if (process.env.STORAGE_DRIVER !== "supabase")
  problems.push("STORAGE_DRIVER must be supabase.");
if ((process.env.CRON_SECRET || "").length < 32)
  problems.push("CRON_SECRET must be at least 32 characters.");
for (const key of ["APP_URL", "SUPABASE_URL"])
  try {
    const url = new URL(process.env[key]);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      throw new Error();
  } catch {
    problems.push(`${key} must be a clean HTTPS origin.`);
  }
for (const key of ["DATABASE_URL", "DIRECT_URL"])
  try {
    const url = new URL(process.env[key]);
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      url.searchParams.get("schema") !== "toga" ||
      url.searchParams.get("sslmode") !== "require"
    )
      throw new Error();
  } catch {
    problems.push(
      `${key} must use Postgres, schema=toga, and sslmode=require.`,
    );
  }

if (
  process.env.EMAIL_PROVIDER !== "gmail" ||
  process.env.GMAIL_USER !== "jointoga@gmail.com" ||
  process.env.EMAIL_FROM !== process.env.GMAIL_USER ||
  !/^[a-zA-Z]{16}$/.test(process.env.GMAIL_APP_PASSWORD || "")
) {
  problems.push(
    "Configure Gmail SMTP with the matching jointoga@gmail.com sender and a 16-letter App Password.",
  );
}

if (problems.length) {
  console.error(
    "Production configuration is incomplete:\n" +
      [...new Set(problems)].map((p) => `- ${p}`).join("\n"),
  );
  process.exitCode = 1;
} else console.log("Production environment validation passed.");
