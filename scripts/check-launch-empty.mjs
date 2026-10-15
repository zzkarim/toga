import { PrismaClient } from "@prisma/client";

// Read-only launch gate. Never delete data automatically from production.
const db = new PrismaClient();
const models = [
  "user",
  "listing",
  "rentalRequest",
  "rating",
  "problemReport",
  "conditionCheck",
  "upload",
  "session",
  "loginToken",
  "emailOtp",
  "email",
  "rateLimit",
];
try {
  const counts = await db.$transaction(
    models.map((model) => db[model].count()),
  );
  const remaining = models.flatMap((model, i) =>
    counts[i] ? [`${model}: ${counts[i]}`] : [],
  );
  if (remaining.length) {
    console.error(
      "Launch database is not empty. Remove only identified prelaunch test data, then recheck:\n" +
        remaining.join("\n"),
    );
    process.exitCode = 1;
  } else {
    console.log(
      "PASS: all application tables are empty. Separately confirm the hosted photo bucket contains no test objects.",
    );
  }
} finally {
  await db.$disconnect();
}
