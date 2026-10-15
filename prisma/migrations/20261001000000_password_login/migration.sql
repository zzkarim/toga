ALTER TABLE "toga"."User" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "toga"."Session" ADD COLUMN "canSetPassword" BOOLEAN NOT NULL DEFAULT false;
