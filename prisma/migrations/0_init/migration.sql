-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKana" TEXT,
    "birthDate" TIMESTAMP(3),
    "gender" TEXT NOT NULL DEFAULT '男',
    "address" TEXT,
    "phone" TEXT,
    "hireDate" TIMESTAMP(3) NOT NULL,
    "position" TEXT,
    "employmentType" TEXT NOT NULL DEFAULT '正社員',
    "resignDate" TIMESTAMP(3),
    "hourlyWage" INTEGER,
    "monthlySalary" INTEGER,
    "memo" TEXT,
    "shiftStart" TEXT,
    "shiftEnd" TEXT,
    "shiftBreak" INTEGER,
    "healthInsuranceEnrolled" BOOLEAN NOT NULL DEFAULT false,
    "pensionEnrolled" BOOLEAN NOT NULL DEFAULT false,
    "employmentInsuranceEnrolled" BOOLEAN NOT NULL DEFAULT false,
    "contractEndDate" TIMESTAMP(3),
    "loginId" TEXT,
    "passwordHash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'employee',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "breakMinutes" INTEGER,
    "status" TEXT,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dakoku" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "time" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dakoku_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payroll" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "workDays" INTEGER NOT NULL DEFAULT 0,
    "workHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grossPay" INTEGER NOT NULL DEFAULT 0,
    "overtimePay" INTEGER NOT NULL DEFAULT 0,
    "allowance" INTEGER NOT NULL DEFAULT 0,
    "totalPay" INTEGER NOT NULL DEFAULT 0,
    "healthInsurance" INTEGER NOT NULL DEFAULT 0,
    "pension" INTEGER NOT NULL DEFAULT 0,
    "employmentInsurance" INTEGER NOT NULL DEFAULT 0,
    "incomeTax" INTEGER NOT NULL DEFAULT 0,
    "residentTax" INTEGER NOT NULL DEFAULT 0,
    "otherDeduction" INTEGER NOT NULL DEFAULT 0,
    "totalDeduction" INTEGER NOT NULL DEFAULT 0,
    "netPay" INTEGER NOT NULL DEFAULT 0,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payroll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rate" (
    "id" TEXT NOT NULL,
    "healthInsurance" DOUBLE PRECISION NOT NULL DEFAULT 10.34,
    "pension" DOUBLE PRECISION NOT NULL DEFAULT 18.3,
    "employmentInsurance" DOUBLE PRECISION NOT NULL DEFAULT 0.6,
    "childcare" DOUBLE PRECISION NOT NULL DEFAULT 0.36,
    "label" TEXT,
    "closedSun" BOOLEAN NOT NULL DEFAULT true,
    "closedMon" BOOLEAN NOT NULL DEFAULT false,
    "closedTue" BOOLEAN NOT NULL DEFAULT false,
    "closedWed" BOOLEAN NOT NULL DEFAULT false,
    "closedThu" BOOLEAN NOT NULL DEFAULT false,
    "closedFri" BOOLEAN NOT NULL DEFAULT false,
    "closedSat" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "nameKana" TEXT,
    "representativeName" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "establishedDate" TIMESTAMP(3),
    "businessType" TEXT,
    "corporateNumber" TEXT,
    "memo" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClosedDate" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'national',

    CONSTRAINT "ClosedDate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaqDocument" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "dataBase64" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FaqDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_loginId_key" ON "Employee"("loginId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_employeeId_date_key" ON "Attendance"("employeeId", "date");

-- CreateIndex
CREATE INDEX "Dakoku_employeeId_date_idx" ON "Dakoku"("employeeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Payroll_employeeId_month_key" ON "Payroll"("employeeId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "ClosedDate_date_key" ON "ClosedDate"("date");

-- CreateIndex
CREATE INDEX "FaqDocument_category_idx" ON "FaqDocument"("category");

-- CreateIndex
CREATE INDEX "FaqDocument_createdAt_idx" ON "FaqDocument"("createdAt");

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dakoku" ADD CONSTRAINT "Dakoku_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

