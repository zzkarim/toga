-- Preserve historical zero values: their original intent cannot be inferred.
ALTER TABLE "Listing" ALTER COLUMN "retailValue" DROP NOT NULL;
