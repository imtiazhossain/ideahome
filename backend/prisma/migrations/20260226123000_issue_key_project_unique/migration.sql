-- Enforce project-local uniqueness for issue keys while allowing NULL keys.
CREATE UNIQUE INDEX "Issue_projectId_key_key" ON "Issue"("projectId", "key");
