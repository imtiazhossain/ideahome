-- CreateTable
CREATE TABLE "IssueCommentEdit" (
    "id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "commentId" TEXT NOT NULL,

    CONSTRAINT "IssueCommentEdit_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "IssueCommentEdit" ADD CONSTRAINT "IssueCommentEdit_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "IssueComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
