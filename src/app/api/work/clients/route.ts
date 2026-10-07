import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { badRequest, requireWorkspace } from "@/lib/work/auth";
import { parseClientInput } from "@/lib/work/validate";

export const dynamic = "force-dynamic";

// 返す項目（メモの暗号文は返さない。メモは /memo で、画面からだけ読む）
const SELECT = { id: true, name: true, sortOrder: true, createdAt: true, updatedAt: true } as const;

// クライアント一覧（プロジェクト数つき）
export async function GET() {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;

  const clients = await prisma.workClient.findMany({
    where: { ownerId: auth.ctx.ownerId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { ...SELECT, encryptedMemo: true, _count: { select: { projects: true } } },
  });
  return NextResponse.json(
    clients.map(({ _count, encryptedMemo, ...c }) => ({ ...c, projectCount: _count.projects, hasMemo: !!encryptedMemo }))
  );
}

// クライアント作成
// POST /api/work/clients  body: { name }
export async function POST(req: NextRequest) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;

  const parsed = parseClientInput(await req.json().catch(() => null), "create");
  if (!parsed.ok) return badRequest(parsed.error);

  try {
    const created = await prisma.workClient.create({ data: { ownerId: auth.ctx.ownerId, name: parsed.data.name! }, select: SELECT });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return badRequest("同じ名前のクライアントがすでにあります");
    }
    throw e;
  }
}
