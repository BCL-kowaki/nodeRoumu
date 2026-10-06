-- クライアント（取引先）を追加し、プロジェクトを必ずどこかのクライアントに所属させる。
-- 既存のプロジェクトは、持ち主ごとに作る「自社」クライアントへまとめて移す（名前はあとで変更できる）。

-- CreateTable
CREATE TABLE "WorkClient" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkClient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkClient_ownerId_name_key" ON "WorkClient"("ownerId", "name");

-- AddForeignKey
ALTER TABLE "WorkClient" ADD CONSTRAINT "WorkClient_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- まず空欄を許して列を足し、既存データを移してから必須にする
ALTER TABLE "WorkProject" ADD COLUMN "clientId" TEXT;

-- プロジェクトを持っている人ごとに「自社」クライアントを作る
INSERT INTO "WorkClient" ("id", "ownerId", "name", "updatedAt")
SELECT 'c' || substr(md5('work_client:' || p."ownerId"), 1, 24), p."ownerId", '自社', CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "ownerId" FROM "WorkProject") p;

UPDATE "WorkProject" wp
SET "clientId" = wc."id"
FROM "WorkClient" wc
WHERE wc."ownerId" = wp."ownerId" AND wc."name" = '自社' AND wp."clientId" IS NULL;

ALTER TABLE "WorkProject" ALTER COLUMN "clientId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "WorkProject_clientId_idx" ON "WorkProject"("clientId");

-- AddForeignKey
ALTER TABLE "WorkProject" ADD CONSTRAINT "WorkProject_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "WorkClient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
