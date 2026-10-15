ALTER TABLE "toga"."Email" ADD COLUMN "deliveryStatus" TEXT NOT NULL DEFAULT 'Queued',
ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "claimedAt" TIMESTAMP(3),
ADD COLUMN "providerMessageId" TEXT;
UPDATE "toga"."Email" SET "deliveryStatus"='Accepted' WHERE "sentAt" IS NOT NULL;
