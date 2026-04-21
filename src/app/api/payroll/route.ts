import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canWritePayroll } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// 賃金台帳取得（クエリ: month, employeeId）
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month"); // YYYY-MM
  const employeeId = searchParams.get("employeeId");

  const where: Record<string, unknown> = {};
  if (month) where.month = month;
  if (employeeId) where.employeeId = employeeId;

  const records = await prisma.payroll.findMany({
    where,
    include: { employee: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(records);
}

// 賃金台帳のupsert（保存・確定）— 代表者のみ
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!canWritePayroll(session.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json();

  const record = await prisma.payroll.upsert({
    where: {
      employeeId_month: {
        employeeId: body.employeeId,
        month: body.month,
      },
    },
    update: {
      workDays: body.workDays || 0,
      workHours: body.workHours || 0,
      grossPay: body.grossPay || 0,
      overtimePay: body.overtimePay || 0,
      allowance: body.allowance || 0,
      totalPay: body.totalPay || 0,
      healthInsurance: body.healthInsurance || 0,
      pension: body.pension || 0,
      employmentInsurance: body.employmentInsurance || 0,
      incomeTax: body.incomeTax || 0,
      residentTax: body.residentTax || 0,
      otherDeduction: body.otherDeduction || 0,
      totalDeduction: body.totalDeduction || 0,
      netPay: body.netPay || 0,
      confirmed: body.confirmed ?? false,
    },
    create: {
      employeeId: body.employeeId,
      month: body.month,
      workDays: body.workDays || 0,
      workHours: body.workHours || 0,
      grossPay: body.grossPay || 0,
      overtimePay: body.overtimePay || 0,
      allowance: body.allowance || 0,
      totalPay: body.totalPay || 0,
      healthInsurance: body.healthInsurance || 0,
      pension: body.pension || 0,
      employmentInsurance: body.employmentInsurance || 0,
      incomeTax: body.incomeTax || 0,
      residentTax: body.residentTax || 0,
      otherDeduction: body.otherDeduction || 0,
      totalDeduction: body.totalDeduction || 0,
      netPay: body.netPay || 0,
      confirmed: body.confirmed ?? false,
    },
  });
  return NextResponse.json(record);
}
