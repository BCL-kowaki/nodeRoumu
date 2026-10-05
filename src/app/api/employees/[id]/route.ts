import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canWriteEmployees } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// 従業員更新（代表者のみ）
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    loginId: body.loginId ?? undefined,
    role: body.role ?? undefined,
    healthInsuranceEnrolled: body.healthInsuranceEnrolled ?? undefined,
    pensionEnrolled: body.pensionEnrolled ?? undefined,
    employmentInsuranceEnrolled: body.employmentInsuranceEnrolled ?? undefined,
    shiftStart: body.shiftStart ?? undefined,
    shiftEnd: body.shiftEnd ?? undefined,
    shiftBreak: body.shiftBreak != null ? Number(body.shiftBreak) : undefined,
  };

  if (body.password) {
    data.passwordHash = await bcrypt.hash(body.password, 10);
  }

  const employee = await prisma.employee.update({
    where: { id: (await params).id },
    data,
  });
  return NextResponse.json(employee);
}

// 従業員削除（代表者のみ）
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!canWriteEmployees(session.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    await prisma.employee.delete({ where: { id: (await params).id } });
  } catch (e) {
    // 業務管理のデータ（プロジェクト・タスク）を持つ従業員は、データ保護のため削除できない（onDelete: Restrict）
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return NextResponse.json(
        { error: "業務管理のデータが残っているため削除できません。退職日の設定で対応してください" },
        { status: 409 }
      );
    }
    throw e;
  }
  return NextResponse.json({ ok: true });
}
