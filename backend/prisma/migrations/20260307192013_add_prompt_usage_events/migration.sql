-- CreateTable
CREATE TABLE "PromptUsageEvent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "promptText" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL,
    "completionTokens" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "promptWordCount" INTEGER NOT NULL,
    "efficiencyScore" INTEGER NOT NULL,
    "improvementHints" JSONB NOT NULL,
    "breakdown" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromptUsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PromptUsageEvent_projectId_createdAt_idx" ON "PromptUsageEvent"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "PromptUsageEvent_projectId_source_createdAt_idx" ON "PromptUsageEvent"("projectId", "source", "createdAt");

-- CreateIndex
CREATE INDEX "PromptUsageEvent_userId_projectId_createdAt_idx" ON "PromptUsageEvent"("userId", "projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "PromptUsageEvent" ADD CONSTRAINT "PromptUsageEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptUsageEvent" ADD CONSTRAINT "PromptUsageEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
