-- CreateTable
CREATE TABLE "TaxDocument" (
    "id" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'other',
    "taxYear" INTEGER,
    "notes" TEXT,
    "textPreview" TEXT,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxDocument_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TaxDocument" ADD CONSTRAINT "TaxDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
