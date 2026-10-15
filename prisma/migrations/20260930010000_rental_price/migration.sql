ALTER TABLE "toga"."RentalRequest" ADD COLUMN "pricePerDay" DOUBLE PRECISION NOT NULL DEFAULT 0;
UPDATE "toga"."RentalRequest" AS r SET "pricePerDay" = l."price"
FROM "toga"."Listing" AS l WHERE r."listingId" = l."id";
