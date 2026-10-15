-- Preserve the amount shown when consent was recorded; never infer it for older rentals.
ALTER TABLE "toga"."RentalRequest" ADD COLUMN "renterAcknowledgedReplacementValue" DOUBLE PRECISION;
