import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canManageAdminUsers } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// 管理ユーザーの権限変更（admin のみ）
// PATCH /api/admin-users/[id]/role
// body: { role: "admin" | "manager" }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!canManageAdminUsers(session.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const role = body.role === "admin" || body.role === "manager" ? body.role : null;
  if (!role) {
    return NextResponse.json({ error: "ロールは代表者か社労士を指定してください" }, { status: 400 });
  }

  // 自分自身の権限は変更させない（誤操作で自分が管理できなくなるのを防ぐ）
  if (id === session.employeeId) {
    return NextResponse.json({ error: "自分自身の権限は変更できません" }, { status: 400 });
  }

  // 対象が admin/manager であることを確認
  const target = await prisma.employee.findUnique({
    where: { id },
    select: { id: true, role: true },
  });
  if (!target || (target.role !== "admin" && target.role !== "manager")) {
    return NextResponse.json({ error: "対象ユーザーが見つかりません" }, { status: 404 });
  }
  if (target.role === role) {
    return NextResponse.json({ ok: true });
  }

  // 代表者を社労士に変える場合、代表者が1人もいなくならないようにする
  if (target.role === "admin") {
    const adminCount = await prisma.employee.count({ where: { role: "admin" } });
    if (adminCount <= 1) {
      return NextResponse.json(
        { error: "代表者が1人もいなくなるため変更できません" },
        { status: 400 }
      );
    }
  }

  await prisma.employee.update({
    where: { id },
    data: { role },
  });

  return NextResponse.json({ ok: true });
}
