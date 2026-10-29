-- CreateTable
CREATE TABLE "GoogleImportCalendar" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoogleImportCalendar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GoogleImportCalendar_ownerId_calendarId_key" ON "GoogleImportCalendar"("ownerId", "calendarId");

-- AddForeignKey
ALTER TABLE "GoogleImportCalendar" ADD CONSTRAINT "GoogleImportCalendar_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

