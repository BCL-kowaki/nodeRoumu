import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jstDateToDb } from "@/lib/date-jst";
import { badRequest, requireWorkspace } from "@/lib/work/auth";
import { ENTRY_INCLUDE, checkLinks } from "@/lib/work/links";
import { parseRange } from "@/lib/work/range";
import { entryRangeFromTimes } from "@/lib/work/entry-time";
import { parseTimeEntryInput } from "@/lib/work/validate";

export const dynamic = "force-dynamic";

// 実績の一覧  GET /api/work/time-entries?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const range = parseRange(req.nextUrl.searchParams);
  if ("error" in range) return badRequest(range.error);

  const entries = await prisma.timeEntry.findMany({
    where: { ownerId: auth.ctx.ownerId, date: { gte: jstDateToDb(range.from), lte: jstDateToDb(range.to) } },
    orderBy: [{ date: "asc" }, { startedAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    include: ENTRY_INCLUDE,
  });
  return NextResponse.json(entries);
}

// 実績の手入力  POST /api/work/time-entries  body: { date, minutes, note?, taskId?, projectId?, routineId?, planId? }
// 時間帯（startTime・endTime）を付けると、分数はその長さになり、タイムラインにも表示される
export async function POST(req: NextRequest) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const parsed = parseTimeEntryInput(await req.json().catch(() => null), "create");
  if (!parsed.ok) return badRequest(parsed.error);
  const d = parsed.data;
  const linkError = await checkLinks(auth.ctx.ownerId, d);
  if (linkError) return badRequest(linkError);
  const range = d.startTime && d.endTime ? entryRangeFromTimes(d.date!, d.startTime, d.endTime) : null;
  if (range && !range.ok) return badRequest(range.error);

  const created = await prisma.timeEntry.create({
    data: {
      ownerId: auth.ctx.ownerId,
      date: jstDateToDb(d.date!),
      minutes: range?.ok ? range.minutes : d.minutes!,
      startedAt: range?.ok ? range.startedAt : null,
      endedAt: range?.ok ? range.endedAt : null,
      source: "manual",
      note: d.note ?? null,
      taskId: d.taskId ?? null,
      projectId: d.projectId ?? null,
      routineId: d.routineId ?? null,
      planId: d.planId ?? null,
    },
    include: ENTRY_INCLUDE,
  });
  return NextResponse.json(created, { status: 201 });
}
