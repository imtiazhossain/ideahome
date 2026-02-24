-- CreateTable
CREATE TABLE "IssueRecording" (
    "id" TEXT NOT NULL,
    "videoUrl" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueRecording_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "IssueRecording" ADD CONSTRAINT "IssueRecording_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing recordings into the new table
INSERT INTO "IssueRecording" ("id", "videoUrl", "issueId", "createdAt")
SELECT gen_random_uuid()::text, "videoUrl", "id", "createdAt"
FROM "Issue"
WHERE "videoUrl" IS NOT NULL;

-- Drop the old column
ALTER TABLE "Issue" DROP COLUMN "videoUrl";
