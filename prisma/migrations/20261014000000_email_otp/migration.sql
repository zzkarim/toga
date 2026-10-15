ALTER TABLE "toga"."Session" ADD COLUMN "passwordSetupUntil" TIMESTAMP(3);
UPDATE "toga"."Session" SET "passwordSetupUntil" = "expiresAt" - INTERVAL '30 days' + INTERVAL '15 minutes' WHERE "canSetPassword" = true;
CREATE TABLE "toga"."EmailOtp" (
 "email" TEXT NOT NULL PRIMARY KEY, "challenge" TEXT NOT NULL, "digest" TEXT NOT NULL,
 "expiresAt" TIMESTAMP(3) NOT NULL, "resendAt" TIMESTAMP(3) NOT NULL, "attempts" INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX "EmailOtp_challenge_key" ON "toga"."EmailOtp"("challenge");
CREATE INDEX "EmailOtp_expiresAt_idx" ON "toga"."EmailOtp"("expiresAt");
REVOKE ALL ON "toga"."EmailOtp" FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON "toga"."EmailOtp" FROM anon; END IF;
 IF EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON "toga"."EmailOtp" FROM authenticated; END IF;
END $$;
