import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { addDays, jstDateToDb, todayJst } from "@/lib/date-jst";
import { badRequest, requireWorkspace } from "@/lib/work/auth";
import { TASK_STATUSES, parseTaskInput, toDbDate } from "@/lib/work/validate";

export const dynamic = "force-dynamic";

// タスク一覧
// GET /api/work/tasks?status=todo,doing&projectId=xxx|none&due=overdue|today|week
//  - due=overdue: 期限が昨日以前 / today: 期限が今日以前 / week: 期限が7日後以内（いずれも日本時間）
export async function GET(req: NextRequest) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;

  const sp = req.nextUrl.searchParams;
  const where: Prisma.WorkTaskWhereInput = { ownerId: auth.ctx.ownerId };

  const statusParam = sp.get("status");
  if (statusParam) {
    where.status = {
      in: statusParam.split(",").filter((s) => (TASK_STATUSES as readonly string[]).includes(s)),
    };
  }

  const projectId = sp.get("projectId");
  if (projectId === "none") where.projectId = null;
  else if (projectId) where.projectId = projectId;

  const due = sp.get("due");
  const today = todayJst();
  if (due === "overdue") where.dueDate = { lt: jstDateToDb(today) };
  else if (due === "today") where.dueDate = { lte: jstDateToDb(today) };
  else if (due === "week") where.dueDate = { lte: jstDateToDb(addDays(today, 7)) };

  const tasks = await prisma.workTask.findMany({
    where,
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { priority: "asc" }, { createdAt: "asc" }],
    include: {
      project: { select: { id: true, name: true, color: true } },
      githubRepo: { select: { fullName: true } },
      _count: { select: { attachments: true } },
    },
  });
  return NextResponse.json(tasks.map(({ _count, ...t }) => ({ ...t, attachmentCount: _count.attachments })));
}

// タスク作成
// POST /api/work/tasks  body: { title, description?, status?, priority?, dueDate?, plannedMinutes?, projectId? }
export async function POST(req: NextRequest) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;

  const parsed = parseTaskInput(await req.json().catch(() => null), "create");
  if (!parsed.ok) return badRequest(parsed.error);
  const d = parsed.data;

  // 他人のプロジェクトに紐づけられないよう、持ち主を確認する
  if (d.projectId) {
    const project = await prisma.workProject.findFirst({
      where: { id: d.projectId, ownerId: auth.ctx.ownerId },
      select: { id: true },
    });
    if (!project) return badRequest("プロジェクトが見つかりません");
  }

  const created = await prisma.workTask.create({
    data: {
      ownerId: auth.ctx.ownerId,
      title: d.title!,
      description: d.description,
      status: d.status,
      priority: d.priority,
      dueDate: toDbDate(d.dueDate),
      plannedMinutes: d.plannedMinutes,
      projectId: d.projectId,
      completedAt: d.status === "done" ? new Date() : null,
    },
    include: { project: { select: { id: true, name: true, color: true } } },
  });
  return NextResponse.json(created, { status: 201 });
}
