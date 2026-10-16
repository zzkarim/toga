ALTER TABLE "toga"."User" ADD COLUMN "accountStatus" TEXT NOT NULL DEFAULT 'Active';
ALTER TABLE "toga"."Listing" ADD COLUMN "categories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], ADD COLUMN "moderationStatus" TEXT NOT NULL DEFAULT 'Visible';
ALTER TABLE "toga"."Listing" ALTER COLUMN "category" SET DEFAULT '';
UPDATE "toga"."Listing" SET "categories" = CASE
 WHEN "category" = 'Interview/Professional' THEN ARRAY['Professional']
 WHEN "category" IN ('Costume','Formal','Professional','Outerwear','Everyday','Custom') THEN ARRAY["category"]
 ELSE ARRAY[]::TEXT[] END;
ALTER TABLE "toga"."ProblemReport" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'Open', ADD COLUMN "adminNote" TEXT NOT NULL DEFAULT '', ADD COLUMN "resolvedAt" TIMESTAMP(3);
CREATE TABLE "toga"."AdminAudit" (
 "id" TEXT NOT NULL PRIMARY KEY, "adminId" TEXT NOT NULL, "action" TEXT NOT NULL,
 "targetType" TEXT NOT NULL, "targetId" TEXT NOT NULL, "note" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AdminAudit_targetType_targetId_createdAt_idx" ON "toga"."AdminAudit"("targetType", "targetId", "createdAt");
