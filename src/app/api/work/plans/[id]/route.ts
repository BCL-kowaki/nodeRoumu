import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jstDateToDb } from "@/lib/date-jst";
import { badRequest, notFound, requireWorkspace } from "@/lib/work/auth";
import { LINK_INCLUDE, checkLinks } from "@/lib/work/links";
import { parsePlanInput } from "@/lib/work/validate";
import { removePlanEvent, resyncPlanEvent } from "@/lib/work/plan-calendar";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// 業務計画の更新
export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const parsed = parsePlanInput(await req.json().catch(() => null), "update");
  if (!parsed.ok) return badRequest(parsed.error);
  const d = parsed.data;

  const current = await prisma.workPlan.findFirst({ where: { id, ownerId: auth.ctx.ownerId }, select: { id: true } });
  if (!current) return notFound();
  const linkError = await checkLinks(auth.ctx.ownerId, d);
  if (linkError) return badRequest(linkError);

  const updated = await prisma.workPlan.update({
    where: { id: current.id },
    data: {
      date: d.date ? jstDateToDb(d.date) : undefined,
      startTime: d.startTime,
      plannedMinutes: d.plannedMinutes,
      title: d.title,
      taskId: d.taskId,
      projectId: d.projectId,
    },
    include: LINK_INCLUDE,
  });
  // Google カレンダーに書き出し済みの計画は、予定も更新する（失敗しても計画の更新は成功）
  await resyncPlanEvent(auth.ctx.ownerId, updated.id);
  return NextResponse.json(updated);
}

// 業務計画の削除（この計画に紐づいた実績は残り、計画の紐づけだけ外れる）
export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const plan = await prisma.workPlan.findFirst({ where: { id, ownerId: auth.ctx.ownerId }, select: { googleEventId: true } });
  const { count } = await prisma.workPlan.deleteMany({ where: { id, ownerId: auth.ctx.ownerId } });
  if (count === 0) return notFound();
  // 書き出し済みの予定もカレンダーから消す（失敗しても計画の削除は成功）
  await removePlanEvent(auth.ctx.ownerId, plan?.googleEventId ?? null);
  return NextResponse.json({ ok: true });
}
