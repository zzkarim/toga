-- Additive only: new table plus nullable columns. No existing values change.
CREATE TABLE "toga"."WantedPost" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT NOT NULL DEFAULT '',
    "size" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "moderationStatus" TEXT NOT NULL DEFAULT 'Visible',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WantedPost_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WantedPost_status_moderationStatus_endDate_createdAt_idx" ON "toga"."WantedPost"("status", "moderationStatus", "endDate", "createdAt");
CREATE INDEX "WantedPost_userId_createdAt_idx" ON "toga"."WantedPost"("userId", "createdAt");
ALTER TABLE "toga"."WantedPost" ADD CONSTRAINT "WantedPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "toga"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "toga"."User" ADD COLUMN "wantedSeenAt" TIMESTAMP(3);

ALTER TABLE "toga"."Listing" ADD COLUMN "sourceWantedId" TEXT;
CREATE INDEX "Listing_sourceWantedId_idx" ON "toga"."Listing"("sourceWantedId");
ALTER TABLE "toga"."Listing" ADD CONSTRAINT "Listing_sourceWantedId_fkey" FOREIGN KEY ("sourceWantedId") REFERENCES "toga"."WantedPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;
