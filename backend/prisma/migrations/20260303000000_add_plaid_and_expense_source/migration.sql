-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "source" TEXT DEFAULT 'manual';
ALTER TABLE "Expense" ADD COLUMN "externalId" TEXT;

-- CreateTable
CREATE TABLE "PlaidItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "transactionsCursor" TEXT,
    "institutionName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaidItem_pkey" PRIMARY KEY ("id")
);
