CREATE TABLE "toga"."RentalActivity" (
 "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "requestId" TEXT NOT NULL,
 "message" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "readAt" TIMESTAMP(3),
 CONSTRAINT "RentalActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "toga"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "RentalActivity_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "toga"."RentalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "RentalActivity_userId_readAt_createdAt_idx" ON "toga"."RentalActivity"("userId","readAt","createdAt");
REVOKE ALL ON "toga"."RentalActivity" FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON "toga"."RentalActivity" FROM anon; END IF;
 IF EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON "toga"."RentalActivity" FROM authenticated; END IF;
END $$;
