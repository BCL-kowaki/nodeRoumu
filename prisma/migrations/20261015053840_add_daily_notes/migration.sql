-- CreateTable
CREATE TABLE "WorkDailyNote" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkDailyNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkDailyNote_ownerId_date_idx" ON "WorkDailyNote"("ownerId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "WorkDailyNote_ownerId_clientId_date_key" ON "WorkDailyNote"("ownerId", "clientId", "date");

-- AddForeignKey
ALTER TABLE "WorkDailyNote" ADD CONSTRAINT "WorkDailyNote_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkDailyNote" ADD CONSTRAINT "WorkDailyNote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "WorkClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

