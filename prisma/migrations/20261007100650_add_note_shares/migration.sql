-- CreateTable
CREATE TABLE "NoteShare" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "notePath" TEXT NOT NULL,
    "encryptedTitle" TEXT NOT NULL,
    "encryptedContent" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "encryptedToken" TEXT NOT NULL,
    "passwordHash" TEXT,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NoteShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NoteShare_tokenHash_key" ON "NoteShare"("tokenHash");

-- CreateIndex
CREATE INDEX "NoteShare_ownerId_notePath_idx" ON "NoteShare"("ownerId", "notePath");

-- CreateIndex
CREATE INDEX "NoteShare_projectId_idx" ON "NoteShare"("projectId");

-- AddForeignKey
ALTER TABLE "NoteShare" ADD CONSTRAINT "NoteShare_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteShare" ADD CONSTRAINT "NoteShare_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "WorkProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

