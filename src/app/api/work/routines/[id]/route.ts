import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jstDateToDb } from "@/lib/date-jst";
import { badRequest, notFound, requireWorkspace } from "@/lib/work/auth";
import { parseRoutineInput, toDbDate } from "@/lib/work/validate";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };
const ymd = (d: Date) => d.toISOString().slice(0, 10);

// ルーティン更新
export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const parsed = parseRoutineInput(await req.json().catch(() => null), "update");
  if (!parsed.ok) return badRequest(parsed.error);
  const d = parsed.data;

  const current = await prisma.routine.findFirst({ where: { id, ownerId: auth.ctx.ownerId } });
  if (!current) return notFound();

  // 保存済みの値と合わせて、頻度と曜日・日付の組み合わせ、期間の前後関係を確認する
  const frequency = d.frequency ?? current.frequency;
  const weekdays = d.weekdays ?? current.weekdays;
  const monthDay = d.monthDay !== undefined ? d.monthDay : current.monthDay;
  if (frequency === "weekly" && !weekdays) return badRequest("曜日を1つ以上選んでください");
  if (frequency === "monthly" && monthDay === null) return badRequest("毎月の日付は1〜31日か月末を選んでください");
  const start = d.startDate ?? ymd(current.startDate);
  const end = d.endDate !== undefined ? d.endDate : current.endDate ? ymd(current.endDate) : null;
  if (end && end < start) return badRequest("終了日は開始日以降にしてください");

  if (d.projectId) {
    const project = await prisma.workProject.findFirst({
      where: { id: d.projectId, ownerId: auth.ctx.ownerId },
      select: { id: true },
    });
    if (!project) return badRequest("プロジェクトが見つかりません");
  }

  const updated = await prisma.routine.update({
    where: { id: current.id },
    data: {
      title: d.title,
      description: d.description,
      frequency,
      weekdays: frequency === "weekly" ? weekdays : 0,
      monthDay: frequency === "monthly" ? monthDay : null,
      skipClosedDays: d.skipClosedDays,
      plannedMinutes: d.plannedMinutes,
      active: d.active,
      // 開始日は必須項目のため「変更しない」か日付のどちらか（未設定にはしない）
      startDate: d.startDate ? jstDateToDb(d.startDate) : undefined,
      endDate: toDbDate(d.endDate),
      projectId: d.projectId,
    },
    include: { project: { select: { id: true, name: true, color: true } } },
  });
  return NextResponse.json(updated);
}

// ルーティン削除（実施記録も一緒に消える）
export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const { count } = await prisma.routine.deleteMany({ where: { id, ownerId: auth.ctx.ownerId } });
  if (count === 0) return notFound();
  return NextResponse.json({ ok: true });
}
