import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canManageAdminUsers } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// 管理ユーザー（admin/manager ロールの Employee）一覧／追加
// 代表者（admin）のみアクセス可

// GET /api/admin-users
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!canManageAdminUsers(session.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const users = await prisma.employee.findMany({
    where: { role: { in: ["admin", "manager"] } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      loginId: true,
      role: true,
      createdAt: true,
    },
  });
  return NextResponse.json(users);
}

// POST /api/admin-users
// body: { name, loginId, password, role: "admin" | "manager" }
// 労働者ではないので hireDate はダミー値（登録日）を入れる
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!canManageAdminUsers(session.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const loginId = typeof body.loginId === "string" ? body.loginId.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const role = body.role === "admin" || body.role === "manager" ? body.role : null;

  if (!name || !loginId || !password || !role) {
    return NextResponse.json(
      { error: "氏名・ログインID・パスワード・ロールは必須です" },
      { status: 400 }
    );
  }

  // パスワード強度チェック
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return NextResponse.json(
      { error: "パスワードは8文字以上で英字と数字を含めてください" },
      { status: 400 }
    );
  }

  // loginId 重複チェック
  const existing = await prisma.employee.findUnique({ where: { loginId } });
  if (existing) {
    return NextResponse.json(
      { error: "このログインIDは既に使われています" },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const created = await prisma.employee.create({
    data: {
      name,
      loginId,
      passwordHash,
      role,
      // 労働者ではないが hireDate は schema で必須のため、作成日をダミーで入れる
      hireDate: new Date(),
      employmentType: role === "admin" ? "役員" : "顧問",
    },
    select: {
      id: true,
      name: true,
      loginId: true,
      role: true,
      createdAt: true,
    },
  });
  return NextResponse.json(created, { status: 201 });
}
