import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { badRequest, notFound, requireWorkspace } from "@/lib/work/auth";
import { parseProjectInput, toDbDate } from "@/lib/work/validate";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// プロジェクト詳細（配下のタスクつき）
export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const project = await prisma.workProject.findFirst({
    where: { id, ownerId: auth.ctx.ownerId },
    include: {
      tasks: { orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!project) return notFound();
  return NextResponse.json(project);
}

// プロジェクト更新
export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const parsed = parseProjectInput(await req.json().catch(() => null), "update");
  if (!parsed.ok) return badRequest(parsed.error);
  const d = parsed.data;

  const current = await prisma.workProject.findFirst({ where: { id, ownerId: auth.ctx.ownerId } });
  if (!current) return notFound();

  // 片方だけ更新された場合も、保存済みの値と合わせて前後関係を確認する
  const start = d.startDate !== undefined ? d.startDate : current.startDate?.toISOString().slice(0, 10) ?? null;
  const due = d.dueDate !== undefined ? d.dueDate : current.dueDate?.toISOString().slice(0, 10) ?? null;
  if (start && due && due < start) return badRequest("期限日は開始日以降にしてください");

  const updated = await prisma.workProject.update({
    where: { id: current.id },
    data: {
      name: d.name,
      description: d.description,
      status: d.status,
      color: d.color,
      startDate: toDbDate(d.startDate),
      dueDate: toDbDate(d.dueDate),
    },
  });
  return NextResponse.json(updated);
}

// プロジェクト削除（配下のタスクは残り、プロジェクト未設定になる）
export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const { count } = await prisma.workProject.deleteMany({ where: { id, ownerId: auth.ctx.ownerId } });
  if (count === 0) return notFound();
  return NextResponse.json({ ok: true });
}
