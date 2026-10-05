import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jstDateToDb, todayJst } from "@/lib/date-jst";
import { badRequest, notFound, requireWorkspace } from "@/lib/work/auth";
import { ENTRY_INCLUDE, checkLinks, type Links } from "@/lib/work/links";
import { elapsedMinutes } from "@/lib/work/time";

export const dynamic = "force-dynamic";

// 計測中のタイマー（無ければ null）
export async function GET() {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const running = await prisma.timeEntry.findFirst({
    where: { ownerId: auth.ctx.ownerId, source: "timer", endedAt: null },
    orderBy: { startedAt: "desc" },
    include: ENTRY_INCLUDE,
  });
  return NextResponse.json(running);
}

type Tx = Prisma.TransactionClient;

// 計測中のタイマーをすべて止める（分数を確定）。止めた件数を返す
async function stopRunning(tx: Tx, ownerId: string, now: Date) {
  const running = await tx.timeEntry.findMany({ where: { ownerId, source: "timer", endedAt: null } });
  for (const e of running) {
    await tx.timeEntry.update({
      where: { id: e.id },
      data: { endedAt: now, minutes: elapsedMinutes(e.startedAt!, now, now) },
    });
  }
  return running;
}

// 同時に押された場合などの衝突（P2034）は、少し間をあけて最大3回やり直す。
// それでも衝突したら ConflictError を投げ、409 で「もう一度」を促す（計測中が2件になることはない）
class ConflictError extends Error {}
const MAX_ATTEMPTS = 3;

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const conflict = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034";
      if (!conflict) throw e;
      if (attempt >= MAX_ATTEMPTS) throw new ConflictError();
      await new Promise((r) => setTimeout(r, 30 + Math.random() * 120));
    }
  }
}

function conflictResponse() {
  return NextResponse.json({ error: "他の操作と重なったため、もう一度お試しください" }, { status: 409 });
}

// タイマーの開始・停止
// POST /api/work/timer  body: { action: "start", taskId?, projectId?, routineId?, planId?, note? } | { action: "stop" }
// 開始すると、計測中のタイマーは自動で止まる（計測中は常に1件まで）
export async function POST(req: NextRequest) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const ownerId = auth.ctx.ownerId;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return badRequest("入力内容が正しくありません");

  if (body.action === "stop") {
    const now = new Date();
    let stopped;
    try {
      stopped = await withRetry(() =>
        prisma.$transaction((tx) => stopRunning(tx, ownerId, now), { isolationLevel: "Serializable" })
      );
    } catch (e) {
      if (e instanceof ConflictError) return conflictResponse();
      throw e;
    }
    if (stopped.length === 0) return notFound();
    const entry = await prisma.timeEntry.findUnique({ where: { id: stopped[0].id }, include: ENTRY_INCLUDE });
    return NextResponse.json(entry);
  }

  if (body.action !== "start") return badRequest("操作の指定が正しくありません");

  const str = (v: unknown) => (typeof v === "string" && v ? v : null);
  const links: Links = {
    taskId: str(body.taskId),
    projectId: str(body.projectId),
    routineId: str(body.routineId),
    planId: str(body.planId),
  };
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 200) || null : null;
  const linkError = await checkLinks(ownerId, links);
  if (linkError) return badRequest(linkError);

  // 計画から開始したらタスク・プロジェクトを、タスクから開始したらプロジェクトを引き継ぐ
  if (links.planId && !links.taskId && !links.projectId) {
    const plan = await prisma.workPlan.findUnique({ where: { id: links.planId }, select: { taskId: true, projectId: true } });
    links.taskId = plan?.taskId ?? null;
    links.projectId = plan?.projectId ?? null;
  }
  if (links.taskId && !links.projectId) {
    const task = await prisma.workTask.findUnique({ where: { id: links.taskId }, select: { projectId: true } });
    links.projectId = task?.projectId ?? null;
  }

  const now = new Date();
  let created;
  try {
    created = await withRetry(() =>
      prisma.$transaction(
        async (tx) => {
          await stopRunning(tx, ownerId, now);
          return tx.timeEntry.create({
            data: {
              ownerId,
              date: jstDateToDb(todayJst(now)),
              startedAt: now,
              source: "timer",
              note,
              taskId: links.taskId ?? null,
              projectId: links.projectId ?? null,
              routineId: links.routineId ?? null,
              planId: links.planId ?? null,
            },
            include: ENTRY_INCLUDE,
          });
        },
        { isolationLevel: "Serializable" }
      )
    );
  } catch (e) {
    if (e instanceof ConflictError) return conflictResponse();
    throw e;
  }
  return NextResponse.json(created, { status: 201 });
}
