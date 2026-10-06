-- AlterTable
ALTER TABLE "WorkPlan" ADD COLUMN     "routineId" TEXT,
ADD COLUMN     "sourceEventId" TEXT;

-- CreateIndex
CREATE INDEX "WorkPlan_routineId_idx" ON "WorkPlan"("routineId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkPlan_ownerId_date_sourceEventId_key" ON "WorkPlan"("ownerId", "date", "sourceEventId");

-- AddForeignKey
ALTER TABLE "WorkPlan" ADD CONSTRAINT "WorkPlan_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

