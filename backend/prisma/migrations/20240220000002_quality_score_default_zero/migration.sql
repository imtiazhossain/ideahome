-- Backfill NULL to 0, then set NOT NULL and default
UPDATE "Issue" SET "qualityScore" = 0 WHERE "qualityScore" IS NULL;
ALTER TABLE "Issue" ALTER COLUMN "qualityScore" SET DEFAULT 0;
ALTER TABLE "Issue" ALTER COLUMN "qualityScore" SET NOT NULL;
