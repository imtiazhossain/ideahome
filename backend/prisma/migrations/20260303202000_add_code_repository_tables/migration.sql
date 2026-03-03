-- CreateTable
CREATE TABLE "CodeRepository" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "repoFullName" TEXT NOT NULL,
    "defaultBranch" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodeRepository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodeAnalysisRun" (
    "id" TEXT NOT NULL,
    "codeRepositoryId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodeAnalysisRun_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CodeRepository" ADD CONSTRAINT "CodeRepository_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeAnalysisRun" ADD CONSTRAINT "CodeAnalysisRun_codeRepositoryId_fkey" FOREIGN KEY ("codeRepositoryId") REFERENCES "CodeRepository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
