ALTER TABLE "toga"."User" ADD COLUMN "paymentInfo" TEXT;
UPDATE "toga"."User" SET "paymentInfo" = 'Venmo: @' || ltrim("venmoHandle", '@') WHERE "venmoHandle" IS NOT NULL AND "venmoHandle" <> '';
ALTER TABLE "toga"."User"
 ADD COLUMN "verifiedPhone" TEXT,
 ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3),
 ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
 ADD COLUMN "smsConsentAt" TIMESTAMP(3),
 ADD COLUMN "smsConsentVersion" TEXT,
 ADD COLUMN "smsNotifications" BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN "smsOptedOutAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "User_verifiedPhone_key" ON "toga"."User"("verifiedPhone");
CREATE TABLE "toga"."SmsChallenge" (
 "phone" TEXT PRIMARY KEY, "email" TEXT NOT NULL, "challenge" TEXT NOT NULL UNIQUE,
 "userId" TEXT, "providerSid" TEXT, "expiresAt" TIMESTAMP(3) NOT NULL,
 "resendAt" TIMESTAMP(3) NOT NULL, "attempts" INTEGER NOT NULL DEFAULT 0,
 "notifications" BOOLEAN NOT NULL DEFAULT false
);
CREATE TABLE "toga"."SmsNotification" (
 "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "text" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'Queued', "attempts" INTEGER NOT NULL DEFAULT 0,
 "claimedAt" TIMESTAMP(3), "providerMessageId" TEXT, "error" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "SmsNotification_status_createdAt_idx" ON "toga"."SmsNotification"("status", "createdAt");
REVOKE ALL ON "toga"."SmsChallenge", "toga"."SmsNotification" FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
 REVOKE ALL ON "toga"."SmsChallenge", "toga"."SmsNotification" FROM anon;
 END IF;
 IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
 REVOKE ALL ON "toga"."SmsChallenge", "toga"."SmsNotification" FROM authenticated;
 END IF;
END $$;
