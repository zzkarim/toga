-- Additive only: no acceptance is inferred for existing accounts or rentals.
ALTER TABLE "toga"."User"
 ADD COLUMN "termsAcceptedAt" TIMESTAMP(3),
 ADD COLUMN "termsVersion" TEXT,
 ADD COLUMN "privacyVersion" TEXT,
 ADD COLUMN "ageConfirmedAt" TIMESTAMP(3);
ALTER TABLE "toga"."Listing" ADD COLUMN "lenderConfirmedAt" TIMESTAMP(3);
ALTER TABLE "toga"."RentalRequest"
 ADD COLUMN "renterAcknowledgedAt" TIMESTAMP(3),
 ADD COLUMN "renterAcknowledgedTermsVersion" TEXT;
