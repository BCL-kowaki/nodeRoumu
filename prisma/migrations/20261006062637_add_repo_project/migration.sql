-- AlterTable
ALTER TABLE "GithubRepo" ADD COLUMN     "projectId" TEXT;

-- CreateIndex
CREATE INDEX "GithubRepo_projectId_idx" ON "GithubRepo"("projectId");

-- AddForeignKey
ALTER TABLE "GithubRepo" ADD CONSTRAINT "GithubRepo_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "WorkProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

