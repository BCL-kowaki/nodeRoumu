-- ルーティンにクライアント（任意）を追加する。
-- 既存のルーティンでプロジェクトがあるものは、そのプロジェクトのクライアントを入れておく。

-- AlterTable
ALTER TABLE "Routine" ADD COLUMN     "clientId" TEXT;

UPDATE "Routine" r
SET "clientId" = p."clientId"
FROM "WorkProject" p
WHERE r."projectId" = p."id" AND r."clientId" IS NULL;

-- CreateIndex
CREATE INDEX "Routine_clientId_idx" ON "Routine"("clientId");

-- AddForeignKey
ALTER TABLE "Routine" ADD CONSTRAINT "Routine_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "WorkClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
