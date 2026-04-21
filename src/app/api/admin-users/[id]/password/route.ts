import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canManageAdminUsers } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// 管理ユーザーのパスワードリセット（admin のみ）
// PATCH /api/admin-users/[id]/password
// body: { newPassword }
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!canManageAdminUsers(session.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

  if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
    return NextResponse.json(
      { error: "パスワードは8文字以上で英字と数字を含めてください" },
      { status: 400 }
    );
  }

  // 対象が admin/manager であることを確認
  const target = await prisma.employee.findUnique({
    where: { id: params.id },
    select: { id: true, role: true },
  });
  if (!target || (target.role !== "admin" && target.role !== "manager")) {
    return NextResponse.json({ error: "対象ユーザーが見つかりません" }, { status: 404 });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.employee.update({
    where: { id: params.id },
    data: { passwordHash },
  });

  return NextResponse.json({ ok: true });
}
