ALTER TABLE "toga"."User" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "toga"."Email" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'gmail', ADD COLUMN "providerEventAt" TIMESTAMP(3), ADD COLUMN "deliveredAt" TIMESTAMP(3);
CREATE TABLE "toga"."EmailDeliveryEvent" (
 "id" TEXT NOT NULL, "providerMessageId" TEXT NOT NULL, "type" TEXT NOT NULL,
 "occurredAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "EmailDeliveryEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EmailDeliveryEvent_providerMessageId_idx" ON "toga"."EmailDeliveryEvent"("providerMessageId");
