import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addDays, jstDateToDb } from "@/lib/date-jst";
import { badRequest, requireWorkspace } from "@/lib/work/auth";
import { parseRange } from "@/lib/work/range";
import { loadClosedChecker } from "@/lib/work/routine-server";
import { attendanceMinutesFor, summarizeDay } from "@/lib/work/time";

export const dynamic = "force-dynamic";

const ymd = (d: Date) => d.toISOString().slice(0, 10);

// 日ごとの「計画・実績・出勤簿の勤務時間・未記録」
// GET /api/work/summary?from=YYYY-MM-DD&to=YYYY-MM-DD
// 出勤簿は代表者本人（ログイン中の従業員）の記録。記録が無い日は attendanceMin が null
export async function GET(req: NextRequest) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const range = parseRange(req.nextUrl.searchParams);
  if ("error" in range) return badRequest(range.error);
  const { from, to } = range;
  const ownerId = auth.ctx.ownerId;
  const dateRange = { gte: jstDateToDb(from), lte: jstDateToDb(to) };

  const [plans, entries, attendance, isClosed] = await Promise.all([
    prisma.workPlan.findMany({ where: { ownerId, date: dateRange }, select: { date: true, plannedMinutes: true } }),
    prisma.timeEntry.findMany({
      where: { ownerId, date: dateRange },
      select: { date: true, minutes: true, startedAt: true, endedAt: true },
    }),
    prisma.attendance.findMany({ where: { employeeId: ownerId, date: dateRange } }),
    loadClosedChecker(from, to),
  ]);

  const now = new Date();
  const days = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const rec = attendance.find((a) => ymd(a.date) === date);
    days.push({
      date,
      ...summarizeDay({
        plans: plans.filter((p) => ymd(p.date) === date),
        entries: entries.filter((e) => ymd(e.date) === date),
        attendanceMinutes: attendanceMinutesFor(rec, isClosed(date)),
        now,
      }),
    });
  }
  return NextResponse.json({ days });
}
