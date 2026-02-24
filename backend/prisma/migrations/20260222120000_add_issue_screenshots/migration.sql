-- CreateTable
CREATE TABLE "IssueScreenshot" (
    "id" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueScreenshot_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "IssueScreenshot" ADD CONSTRAINT "IssueScreenshot_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
