import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 自分のパスワードを変更する（全ロール共通）
// - セッションから employeeId を取得（なりすまし不可）
// - 現在のパスを bcrypt.compare で検証
// - 新パスは8文字以上・英数字を含む
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

  // 新パスバリデーション
  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: "新しいパスワードは8文字以上で入力してください" },
      { status: 400 }
    );
  }
  const hasLetter = /[A-Za-z]/.test(newPassword);
  const hasDigit = /\d/.test(newPassword);
  if (!hasLetter || !hasDigit) {
    return NextResponse.json(
      { error: "新しいパスワードは英字と数字の両方を含めてください" },
      { status: 400 }
    );
  }

  // 本人の passwordHash を取得
  const employee = await prisma.employee.findUnique({
    where: { id: session.employeeId },
    select: { passwordHash: true },
  });

  if (!employee || !employee.passwordHash) {
    return NextResponse.json(
      { error: "現在のパスワードが正しくありません" },
      { status: 400 }
    );
  }

  const valid = await bcrypt.compare(currentPassword, employee.passwordHash);
  if (!valid) {
    return NextResponse.json(
      { error: "現在のパスワードが正しくありません" },
      { status: 400 }
    );
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await prisma.employee.update({
    where: { id: session.employeeId },
    data: { passwordHash: newHash },
  });

  return NextResponse.json({ ok: true });
}
