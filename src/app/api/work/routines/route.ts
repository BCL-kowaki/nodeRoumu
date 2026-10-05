import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { todayJst } from "@/lib/date-jst";
import { badRequest, requireWorkspace } from "@/lib/work/auth";
import { parseRoutineInput, toDbDate } from "@/lib/work/validate";

export const dynamic = "force-dynamic";

// ルーティン一覧（停止中も含む）
export async function GET() {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;

  const routines = await prisma.routine.findMany({
    where: { ownerId: auth.ctx.ownerId },
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    include: { project: { select: { id: true, name: true, color: true } } },
  });
  return NextResponse.json(routines);
}

// ルーティン作成（開始日を省略したら今日から）
export async function POST(req: NextRequest) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;

  const parsed = parseRoutineInput(await req.json().catch(() => null), "create");
  if (!parsed.ok) return badRequest(parsed.error);
  const d = parsed.data;
  const startDate = d.startDate ?? todayJst();
  if (d.endDate && d.endDate < startDate) return badRequest("終了日は開始日以降にしてください");

  if (d.projectId) {
    const project = await prisma.workProject.findFirst({
      where: { id: d.projectId, ownerId: auth.ctx.ownerId },
      select: { id: true },
    });
    if (!project) return badRequest("プロジェクトが見つかりません");
  }

  const created = await prisma.routine.create({
    data: {
      ownerId: auth.ctx.ownerId,
      title: d.title!,
      description: d.description,
      frequency: d.frequency!,
      // 頻度に関係のない項目は保存しない（毎日なのに曜日が残る、などを防ぐ）
      weekdays: d.frequency === "weekly" ? d.weekdays ?? 0 : 0,
      monthDay: d.frequency === "monthly" ? d.monthDay ?? null : null,
      skipClosedDays: d.skipClosedDays,
      plannedMinutes: d.plannedMinutes,
      active: d.active,
      startDate: toDbDate(startDate)!,
      endDate: toDbDate(d.endDate),
      projectId: d.projectId,
    },
    include: { project: { select: { id: true, name: true, color: true } } },
  });
  return NextResponse.json(created, { status: 201 });
}
