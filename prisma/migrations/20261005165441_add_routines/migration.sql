-- CreateTable
CREATE TABLE "Routine" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "frequency" TEXT NOT NULL,
    "weekdays" INTEGER NOT NULL DEFAULT 0,
    "monthDay" INTEGER,
    "skipClosedDays" BOOLEAN NOT NULL DEFAULT false,
    "plannedMinutes" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Routine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutineCheck" (
    "id" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'done',
    "note" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoutineCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Routine_ownerId_active_idx" ON "Routine"("ownerId", "active");

-- CreateIndex
CREATE INDEX "Routine_projectId_idx" ON "Routine"("projectId");

-- CreateIndex
CREATE INDEX "RoutineCheck_date_idx" ON "RoutineCheck"("date");

-- CreateIndex
CREATE UNIQUE INDEX "RoutineCheck_routineId_date_key" ON "RoutineCheck"("routineId", "date");

-- AddForeignKey
ALTER TABLE "Routine" ADD CONSTRAINT "Routine_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Routine" ADD CONSTRAINT "Routine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "WorkProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineCheck" ADD CONSTRAINT "RoutineCheck_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
