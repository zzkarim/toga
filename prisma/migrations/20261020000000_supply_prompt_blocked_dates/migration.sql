-- Additive only: nullable prompt marker and owner-blocked date ranges (default empty).
ALTER TABLE "toga"."User" ADD COLUMN "supplyPromptHandledAt" TIMESTAMP(3);
ALTER TABLE "toga"."Listing" ADD COLUMN "blockedRanges" JSONB NOT NULL DEFAULT '[]';
