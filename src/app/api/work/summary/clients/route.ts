import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jstDateToDb } from "@/lib/date-jst";
import { badRequest, requireWorkspace } from "@/lib/work/auth";
import { summarizeByClient } from "@/lib/work/client-summary";
import { parseRange } from "@/lib/work/range";

export const dynamic = "force-dynamic";

// クライアント別の計画・実績の合計
// GET /api/work/summary/clients?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const range = parseRange(req.nextUrl.searchParams);
  if ("error" in range) return badRequest(range.error);
  const ownerId = auth.ctx.ownerId;
  const date = { gte: jstDateToDb(range.from), lte: jstDateToDb(range.to) };

  const [plans, entries, projects, clients] = await Promise.all([
    prisma.workPlan.findMany({
      where: { ownerId, date },
      select: { plannedMinutes: true, projectId: true, task: { select: { projectId: true } } },
    }),
    prisma.timeEntry.findMany({
      where: { ownerId, date },
      select: {
        minutes: true,
        startedAt: true,
        endedAt: true,
        projectId: true,
        task: { select: { projectId: true } },
        plan: { select: { projectId: true } },
        routine: { select: { projectId: true, clientId: true } },
      },
    }),
    prisma.workProject.findMany({
      where: { ownerId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, clientId: true },
    }),
    prisma.workClient.findMany({
      where: { ownerId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    }),
  ]);

  return NextResponse.json({ from: range.from, to: range.to, ...summarizeByClient({ plans, entries, projects, clients: clients.map((c) => c.id), now: new Date() }) });
}
