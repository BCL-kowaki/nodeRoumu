import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createToken, setSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { loginId, password, remember } = await req.json();

  if (!loginId || !password) {
    return NextResponse.json(
      { error: "ログインIDとパスワードを入力してください" },
      { status: 400 }
    );
  }

  const employee = await prisma.employee.findUnique({
    where: { loginId },
  });

  if (!employee || !employee.passwordHash) {
    return NextResponse.json(
      { error: "ログインIDまたはパスワードが正しくありません" },
      { status: 401 }
    );
  }

  const valid = await bcrypt.compare(password, employee.passwordHash);
  if (!valid) {
    return NextResponse.json(
      { error: "ログインIDまたはパスワードが正しくありません" },
      { status: 401 }
    );
  }

  const token = await createToken({
    employeeId: employee.id,
    loginId: employee.loginId!,
    role: employee.role as "admin" | "manager" | "employee",
    name: employee.name,
  }, !!remember);

  setSessionCookie(token, !!remember);

  return NextResponse.json({
    ok: true,
    role: employee.role,
    name: employee.name,
  });
}
