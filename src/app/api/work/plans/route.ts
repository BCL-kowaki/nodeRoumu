import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jstDateToDb } from "@/lib/date-jst";
import { badRequest, requireWorkspace } from "@/lib/work/auth";
import { LINK_INCLUDE, checkLinks } from "@/lib/work/links";
import { parseRange } from "@/lib/work/range";
import { parsePlanInput } from "@/lib/work/validate";

export const dynamic = "force-dynamic";

// 業務計画の一覧  GET /api/work/plans?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const range = parseRange(req.nextUrl.searchParams);
  if ("error" in range) return badRequest(range.error);

  const plans = await prisma.workPlan.findMany({
    where: { ownerId: auth.ctx.ownerId, date: { gte: jstDateToDb(range.from), lte: jstDateToDb(range.to) } },
    orderBy: [{ date: "asc" }, { startTime: { sort: "asc", nulls: "last" } }, { sortOrder: "asc" }, { createdAt: "asc" }],
    include: LINK_INCLUDE,
  });
  return NextResponse.json(plans);
}

// 業務計画の作成  POST /api/work/plans  body: { date, title, plannedMinutes, startTime?, taskId?, projectId? }
export async function POST(req: NextRequest) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const parsed = parsePlanInput(await req.json().catch(() => null), "create");
  if (!parsed.ok) return badRequest(parsed.error);
  const d = parsed.data;
  const linkError = await checkLinks(auth.ctx.ownerId, d);
  if (linkError) return badRequest(linkError);

  const created = await prisma.workPlan.create({
    data: {
      ownerId: auth.ctx.ownerId,
      date: jstDateToDb(d.date!),
      startTime: d.startTime ?? null,
      plannedMinutes: d.plannedMinutes!,
      title: d.title!,
      taskId: d.taskId ?? null,
      projectId: d.projectId ?? null,
    },
    include: LINK_INCLUDE,
  });
  return NextResponse.json(created, { status: 201 });
}
