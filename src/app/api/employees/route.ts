import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canWriteEmployees } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// 従業員一覧取得（passwordHashは除外）
// ?scope=workers を付けると role="employee" のみ返す（労働者名簿用）
// 省略時は従来どおり全員返す（打刻・出勤簿等の既存画面の互換性のため）
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope");

  const where = scope === "workers" ? { role: "employee" } : {};

  const employees = await prisma.employee.findMany({
    where,
    orderBy: { createdAt: "asc" },
    select: {
      id: true, name: true, nameKana: true, birthDate: true, gender: true,
      address: true, phone: true, hireDate: true, position: true,
      employmentType: true, resignDate: true, hourlyWage: true,
      monthlySalary: true, memo: true, loginId: true, role: true,
      healthInsuranceEnrolled: true, pensionEnrolled: true,
      employmentInsuranceEnrolled: true,
      contractEndDate: true,
      shiftStart: true, shiftEnd: true, shiftBreak: true,
      createdAt: true, updatedAt: true,
    },
  });
  return NextResponse.json(employees);
}

// 従業員新規作成（代表者のみ）
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!canWriteEmployees(session.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {
    name: body.name,
    nameKana: body.nameKana || null,
    birthDate: body.birthDate ? new Date(body.birthDate) : null,
    gender: body.gender || "男",
    address: body.address || null,
    phone: body.phone || null,
    hireDate: new Date(body.hireDate),
    position: body.position || null,
    employmentType: body.employmentType || "正社員",
    resignDate: body.resignDate ? new Date(body.resignDate) : null,
    hourlyWage: body.hourlyWage ? Number(body.hourlyWage) : null,
    monthlySalary: body.monthlySalary ? Number(body.monthlySalary) : null,
    memo: body.memo || null,
    loginId: body.loginId || null,
    role: body.role || "employee",
    healthInsuranceEnrolled: body.healthInsuranceEnrolled ?? false,
    pensionEnrolled: body.pensionEnrolled ?? false,
    employmentInsuranceEnrolled: body.employmentInsuranceEnrolled ?? false,
    shiftStart: body.shiftStart || null,
    shiftEnd: body.shiftEnd || null,
    shiftBreak: body.shiftBreak ? Number(body.shiftBreak) : null,
  };

  if (body.password) {
    data.passwordHash = await bcrypt.hash(body.password, 10);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const employee = await prisma.employee.create({ data: data as any });
  return NextResponse.json(employee, { status: 201 });
}
