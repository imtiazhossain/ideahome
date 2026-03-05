-- Add per-user appearance preference storage.
ALTER TABLE "User"
ADD COLUMN "appearancePrefs" JSONB;
