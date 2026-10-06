import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { badRequest, notFound, requireWorkspace } from "@/lib/work/auth";
import { parseRepoPatch } from "@/lib/work/validate";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// リポジトリの設定変更（Issue 同期の ON/OFF・紐づけるプロジェクト）
// PATCH /api/work/github/repos/[id]  body: { syncIssues?: boolean, projectId?: string | null }
// プロジェクトを紐づけたときは、このリポジトリから取り込んだ「プロジェクト未設定」のタスクも、そのプロジェクトに入れる
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const ownerId = auth.ctx.ownerId;

  const parsed = parseRepoPatch(await req.json().catch(() => null));
  if (!parsed.ok) return badRequest(parsed.error);
  const d = parsed.data;

  const repo = await prisma.githubRepo.findFirst({ where: { id, ownerId }, select: { id: true } });
  if (!repo) return notFound();
  if (d.projectId) {
    const project = await prisma.workProject.findFirst({ where: { id: d.projectId, ownerId }, select: { id: true } });
    if (!project) return badRequest("プロジェクトが見つかりません");
  }

  const [updated, moved] = await prisma.$transaction([
    prisma.githubRepo.update({ where: { id: repo.id }, data: { syncIssues: d.syncIssues, projectId: d.projectId } }),
    prisma.workTask.updateMany({
      // 手で別のプロジェクトに入れたタスクは動かさない
      where: d.projectId ? { ownerId, githubRepoId: repo.id, projectId: null } : { id: "__none__" },
      data: { projectId: d.projectId ?? null },
    }),
  ]);
  return NextResponse.json({ ...updated, movedTaskCount: moved.count });
}
