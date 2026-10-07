import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { badRequest, notFound, requireWorkspace } from "@/lib/work/auth";
import { parseClientInput } from "@/lib/work/validate";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// クライアントの名前の変更
export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const parsed = parseClientInput(await req.json().catch(() => null), "update");
  if (!parsed.ok) return badRequest(parsed.error);

  const current = await prisma.workClient.findFirst({ where: { id, ownerId: auth.ctx.ownerId } });
  if (!current) return notFound();
  try {
    const updated = await prisma.workClient.update({
      where: { id: current.id },
      data: { name: parsed.data.name },
      select: { id: true, name: true, sortOrder: true, createdAt: true, updatedAt: true },
    });
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return badRequest("同じ名前のクライアントがすでにあります");
    }
    throw e;
  }
}

// クライアントの削除。プロジェクトが残っている間は削除できない（先に移すか削除する）
export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const current = await prisma.workClient.findFirst({
    where: { id, ownerId: auth.ctx.ownerId },
    include: { _count: { select: { projects: true } } },
  });
  if (!current) return notFound();
  if (current._count.projects > 0) {
    return NextResponse.json(
      { error: "プロジェクトが残っているため削除できません。先にプロジェクトを別のクライアントへ移すか、削除してください" },
      { status: 409 }
    );
  }
  await prisma.workClient.delete({ where: { id: current.id } });
  return NextResponse.json({ ok: true });
}
