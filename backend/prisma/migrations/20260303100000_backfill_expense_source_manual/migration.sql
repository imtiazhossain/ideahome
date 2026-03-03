-- Backfill existing expenses without source to 'manual'
UPDATE "Expense" SET "source" = 'manual' WHERE "source" IS NULL;
