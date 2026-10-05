import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { badRequest, notFound, requireWorkspace } from "@/lib/work/auth";
import { completedAtFor, parseTaskInput, toDbDate } from "@/lib/work/validate";
import { githubErrorMessage, updateIssueState } from "@/lib/github";
import { issueStateFor, needsIssueUpdate } from "@/lib/work/github-sync";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// タスク更新（完了にすると完了日時を記録、完了から戻すと消す）
export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const parsed = parseTaskInput(await req.json().catch(() => null), "update");
  if (!parsed.ok) return badRequest(parsed.error);
  const d = parsed.data;

  const current = await prisma.workTask.findFirst({ where: { id, ownerId: auth.ctx.ownerId } });
  if (!current) return notFound();

  if (d.projectId) {
    const project = await prisma.workProject.findFirst({
      where: { id: d.projectId, ownerId: auth.ctx.ownerId },
      select: { id: true },
    });
    if (!project) return badRequest("プロジェクトが見つかりません");
  }

  // GitHub の Issue と紐づいたタスクを完了・中止・再開したら、先に GitHub 側を更新する。
  // 失敗したらアプリ側も変更しない（両者がずれないように）
  let github: { githubState: string; githubUpdatedAt: Date } | undefined;
  if (current.githubRepoId && current.githubIssueNumber && needsIssueUpdate(current.status, d.status)) {
    const repo = await prisma.githubRepo.findFirst({
      where: { id: current.githubRepoId, ownerId: auth.ctx.ownerId },
      select: { fullName: true },
    });
    if (repo) {
      try {
        const issue = await updateIssueState(repo.fullName, current.githubIssueNumber, issueStateFor(d.status!));
        github = { githubState: issue.state, githubUpdatedAt: new Date(issue.updated_at) };
      } catch (e) {
        return NextResponse.json({ error: `GitHub の Issue を更新できませんでした：${githubErrorMessage(e)}` }, { status: 502 });
      }
    }
  }

  const updated = await prisma.workTask.update({
    where: { id: current.id },
    data: {
      ...github,
      title: d.title,
      description: d.description,
      status: d.status,
      priority: d.priority,
      dueDate: toDbDate(d.dueDate),
      plannedMinutes: d.plannedMinutes,
      projectId: d.projectId,
      completedAt: completedAtFor(current.status, d.status, new Date()),
    },
    include: { project: { select: { id: true, name: true, color: true } } },
  });
  return NextResponse.json(updated);
}

// タスク削除
export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const { count } = await prisma.workTask.deleteMany({ where: { id, ownerId: auth.ctx.ownerId } });
  if (count === 0) return notFound();
  return NextResponse.json({ ok: true });
}
