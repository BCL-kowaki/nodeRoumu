import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addDays, jstDateToDb } from "@/lib/date-jst";
import { badRequest, notFound, requireWorkspace } from "@/lib/work/auth";
import { isRoutineDue } from "@/lib/work/recurrence";
import { loadClosedChecker, toRule } from "@/lib/work/routine-server";
import { parseRoutineCheckInput } from "@/lib/work/validate";

export const dynamic = "force-dynamic";

const MAX_RANGE_DAYS = 62;
const isYmd = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

// 期間内の実施日と実施状況
// GET /api/work/routines/checks?from=YYYY-MM-DD&to=YYYY-MM-DD
// → { days: [{ date, closed, items: [{ routineId, status: "done" | "skipped" | null }] }] }
export async function GET(req: NextRequest) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  if (!isYmd(from) || !isYmd(to) || to < from) return badRequest("期間の指定が正しくありません");
  try {
    jstDateToDb(from);
    jstDateToDb(to);
  } catch {
    return badRequest("期間の指定が正しくありません");
  }
  if (to > addDays(from, MAX_RANGE_DAYS - 1)) return badRequest(`期間は${MAX_RANGE_DAYS}日以内で指定してください`);

  const [routines, isClosed] = await Promise.all([
    prisma.routine.findMany({
      where: { ownerId: auth.ctx.ownerId, active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        checks: { where: { date: { gte: jstDateToDb(from), lte: jstDateToDb(to) } } },
      },
    }),
    loadClosedChecker(from, to),
  ]);

  const days = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const closed = isClosed(date);
    const items = routines
      .filter((r) => isRoutineDue(toRule(r), date, closed))
      .map((r) => ({
        routineId: r.id,
        status: r.checks.find((c) => c.date.toISOString().slice(0, 10) === date)?.status ?? null,
      }));
    days.push({ date, closed, items });
  }
  return NextResponse.json({ days });
}

// 実施・スキップを記録（同じ日を再度送ると上書き）
// PUT /api/work/routines/checks  body: { routineId, date, status: "done" | "skipped" }
export async function PUT(req: NextRequest) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;

  const parsed = parseRoutineCheckInput(await req.json().catch(() => null));
  if (!parsed.ok) return badRequest(parsed.error);
  const { routineId, date, status } = parsed.data;

  const routine = await prisma.routine.findFirst({ where: { id: routineId, ownerId: auth.ctx.ownerId } });
  if (!routine) return notFound();
  // 実施日でない日の記録は、達成率などの集計を狂わせるため受け付けない
  const isClosed = await loadClosedChecker(date, date);
  if (!isRoutineDue(toRule(routine), date, isClosed(date))) return badRequest("この日はルーティンの実施日ではありません");

  const check = await prisma.routineCheck.upsert({
    where: { routineId_date: { routineId, date: jstDateToDb(date) } },
    update: { status, checkedAt: new Date() },
    create: { routineId, date: jstDateToDb(date), status },
  });
  return NextResponse.json(check);
}

// 記録を取り消す（未実施に戻す）
// DELETE /api/work/routines/checks?routineId=xxx&date=YYYY-MM-DD
export async function DELETE(req: NextRequest) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;

  const routineId = req.nextUrl.searchParams.get("routineId");
  const date = req.nextUrl.searchParams.get("date");
  if (!routineId || !isYmd(date)) return badRequest("取り消す記録の指定が正しくありません");

  const { count } = await prisma.routineCheck.deleteMany({
    where: { routineId, date: jstDateToDb(date), routine: { ownerId: auth.ctx.ownerId } },
  });
  if (count === 0) return notFound();
  return NextResponse.json({ ok: true });
}
