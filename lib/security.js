import { authLog } from "./auth-log.mjs";
import { createHash } from "node:crypto";
import { db } from "./db.js";
export const hash = (value) => createHash("sha256").update(value).digest("hex");
export function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}
export async function limit(key, max, milliseconds, store = db) {
  const id = hash(key),
    now = new Date(),
    resetsAt = new Date(+now + milliseconds);
  const rows = await store.$queryRaw`
    INSERT INTO "toga"."RateLimit" ("id", "count", "resetsAt") VALUES (${id}, 1, ${resetsAt})
    ON CONFLICT ("id") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."resetsAt" <= ${now} THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetsAt" = CASE WHEN "RateLimit"."resetsAt" <= ${now} THEN ${resetsAt} ELSE "RateLimit"."resetsAt" END
    RETURNING "count"`;
  if (rows[0].count > max) {
    authLog("rate_limit_triggered");
    fail("Too many attempts. Please wait a few minutes and try again.", 429);
  }
}
