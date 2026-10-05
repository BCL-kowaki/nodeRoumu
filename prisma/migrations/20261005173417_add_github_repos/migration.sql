-- AlterTable
ALTER TABLE "WorkTask" ADD COLUMN     "githubHtmlUrl" TEXT,
ADD COLUMN     "githubIssueNumber" INTEGER,
ADD COLUMN     "githubRepoId" TEXT,
ADD COLUMN     "githubState" TEXT,
ADD COLUMN     "githubUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "GithubRepo" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "githubId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "description" TEXT,
    "isPrivate" BOOLEAN NOT NULL,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "htmlUrl" TEXT NOT NULL,
    "defaultBranch" TEXT NOT NULL,
    "openIssuesCount" INTEGER NOT NULL DEFAULT 0,
    "openPrCount" INTEGER NOT NULL DEFAULT 0,
    "pushedAt" TIMESTAMP(3),
    "syncIssues" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GithubRepo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GithubRepo_ownerId_githubId_key" ON "GithubRepo"("ownerId", "githubId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkTask_ownerId_githubRepoId_githubIssueNumber_key" ON "WorkTask"("ownerId", "githubRepoId", "githubIssueNumber");

-- AddForeignKey
ALTER TABLE "WorkTask" ADD CONSTRAINT "WorkTask_githubRepoId_fkey" FOREIGN KEY ("githubRepoId") REFERENCES "GithubRepo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GithubRepo" ADD CONSTRAINT "GithubRepo_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

