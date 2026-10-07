import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jstDateToDb } from "@/lib/date-jst";
import { badRequest, notFound, requireWorkspace } from "@/lib/work/auth";
import { ENTRY_INCLUDE, checkLinks } from "@/lib/work/links";
import { entryRangeFromTimes } from "@/lib/work/entry-time";
import { parseTimeEntryInput } from "@/lib/work/validate";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// 実績の編集（時間帯・分数・日付・メモ・紐づけ）。止め忘れたタイマーの時間を直す用途も兼ねる
// 時間帯（startTime・endTime、日本時間 HH:MM）を送ると、開始・終了の日時と分数をまとめて直す
export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const parsed = parseTimeEntryInput(await req.json().catch(() => null), "update");
  if (!parsed.ok) return badRequest(parsed.error);
  const d = parsed.data;

  const current = await prisma.timeEntry.findFirst({ where: { id, ownerId: auth.ctx.ownerId } });
  if (!current) return notFound();
  // 計測中のタイマーの時間は、止めてからでないと直せない（分数は停止時に確定するため）
  if (current.startedAt && !current.endedAt && (d.minutes !== undefined || d.date !== undefined || d.startTime !== undefined)) {
    return badRequest("計測中のタイマーは、停止してから時間を修正してください");
  }
  const linkError = await checkLinks(auth.ctx.ownerId, d);
  if (linkError) return badRequest(linkError);
  const date = d.date ?? current.date.toISOString().slice(0, 10);
  const range = d.startTime && d.endTime ? entryRangeFromTimes(date, d.startTime, d.endTime) : null;
  if (range && !range.ok) return badRequest(range.error);

  const updated = await prisma.timeEntry.update({
    where: { id: current.id },
    data: {
      date: d.date ? jstDateToDb(d.date) : undefined,
      minutes: range?.ok ? range.minutes : d.minutes,
      startedAt: range?.ok ? range.startedAt : undefined,
      endedAt: range?.ok ? range.endedAt : undefined,
      note: d.note,
      taskId: d.taskId,
      projectId: d.projectId,
      routineId: d.routineId,
      planId: d.planId,
    },
    include: ENTRY_INCLUDE,
  });
  return NextResponse.json(updated);
}

// 実績の削除
export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const { count } = await prisma.timeEntry.deleteMany({ where: { id, ownerId: auth.ctx.ownerId } });
  if (count === 0) return notFound();
  return NextResponse.json({ ok: true });
}
