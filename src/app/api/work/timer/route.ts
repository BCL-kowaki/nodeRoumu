import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jstDateToDb, todayJst } from "@/lib/date-jst";
import { badRequest, notFound, requireWorkspace } from "@/lib/work/auth";
import { ENTRY_INCLUDE, checkLinks, type Links } from "@/lib/work/links";
import { elapsedMinutes } from "@/lib/work/time";
import { findSameTarget } from "@/lib/work/timer";

export const dynamic = "force-dynamic";

// 計測中のタイマーの一覧（複数を同時に計測できる。無ければ空の配列）
export async function GET() {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const running = await prisma.timeEntry.findMany({
    where: { ownerId: auth.ctx.ownerId, source: "timer", endedAt: null },
    orderBy: { startedAt: "asc" },
    include: ENTRY_INCLUDE,
  });
  return NextResponse.json(running);
}

type Tx = Prisma.TransactionClient;

// 計測中のタイマーを止める（分数を確定）。entryId を指定したらその1件、無ければすべて。止めたものを返す
async function stopRunning(tx: Tx, ownerId: string, now: Date, entryId?: string) {
  const running = await tx.timeEntry.findMany({
    where: { ownerId, source: "timer", endedAt: null, ...(entryId ? { id: entryId } : {}) },
  });
  for (const e of running) {
    await tx.timeEntry.update({
      where: { id: e.id },
      data: { endedAt: now, minutes: elapsedMinutes(e.startedAt!, now, now) },
    });
  }
  return running;
}

// 同時に押された場合などの衝突（P2034）は、少し間をあけて最大3回やり直す。
// それでも衝突したら ConflictError を投げ、409 で「もう一度」を促す（同じ対象を二重に計測することはない）
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
// POST /api/work/timer  body: { action: "start", taskId?, projectId?, routineId?, planId?, note? } | { action: "stop", entryId? }
// 複数のタイマーを同時に計測できる（並行作業）。同じタスク・ルーティン・計画がすでに計測中なら、それを返す（二重にしない）
// 停止は entryId で1件ずつ。entryId が無ければ計測中をすべて止める
export async function POST(req: NextRequest) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const ownerId = auth.ctx.ownerId;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return badRequest("入力内容が正しくありません");

  if (body.action === "stop") {
    const now = new Date();
    const entryId = typeof body.entryId === "string" && body.entryId ? body.entryId : undefined;
    let stopped;
    try {
      stopped = await withRetry(() =>
        prisma.$transaction((tx) => stopRunning(tx, ownerId, now, entryId), { isolationLevel: "Serializable" })
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

  // 計画から開始したらタスク・プロジェクト・ルーティンを、タスクから開始したらプロジェクトを引き継ぐ
  if (links.planId && !links.taskId && !links.projectId && !links.routineId) {
    const plan = await prisma.workPlan.findUnique({
      where: { id: links.planId },
      select: { taskId: true, projectId: true, routineId: true },
    });
    links.taskId = plan?.taskId ?? null;
    links.projectId = plan?.projectId ?? null;
    links.routineId = plan?.routineId ?? null;
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
          const running = await tx.timeEntry.findMany({
            where: { ownerId, source: "timer", endedAt: null },
            select: { id: true, taskId: true, routineId: true, planId: true, projectId: true },
          });
          const same = findSameTarget(running, links);
          if (same) return { existing: true as const, entry: await tx.timeEntry.findUniqueOrThrow({ where: { id: same.id }, include: ENTRY_INCLUDE }) };
          const entry = await tx.timeEntry.create({
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
          return { existing: false as const, entry };
        },
        { isolationLevel: "Serializable" }
      )
    );
  } catch (e) {
    if (e instanceof ConflictError) return conflictResponse();
    throw e;
  }
  // すでに同じ対象を計測中なら、そのタイマーを 200 で返す（新しくは作らない）
  return NextResponse.json(created.entry, { status: created.existing ? 200 : 201 });
}
