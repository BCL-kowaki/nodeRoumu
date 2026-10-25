-- AlterTable
ALTER TABLE "WorkPlan" ADD COLUMN     "clientId" TEXT;

-- AddForeignKey
ALTER TABLE "WorkPlan" ADD CONSTRAINT "WorkPlan_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "WorkClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

