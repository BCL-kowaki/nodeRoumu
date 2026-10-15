import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jstDateToDb } from "@/lib/date-jst";
import { badRequest, requireWorkspace } from "@/lib/work/auth";
import { MAX_DAILY_NOTE, handoverFrom, parseDailyNote } from "@/lib/work/daily-note";
import { ownsClient } from "@/lib/work/links";
import { currentMcpContext } from "@/lib/work/mcp-context";

export const dynamic = "force-dynamic";

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const SELECT = { clientId: true, date: true, body: true, updatedAt: true, client: { select: { name: true } } } as const;
type Row = { clientId: string; date: Date; body: string; updatedAt: Date; client: { name: string } };
const view = (n: Row) => ({ clientId: n.clientId, clientName: n.client.name, date: ymd(n.date), body: n.body, updatedAt: n.updatedAt });

// その日のメモと、前回からの引き継ぎ（クライアントごとに、その日より前で最後に書いたメモ。30日以内）
// GET /api/work/daily-notes?date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const date = req.nextUrl.searchParams.get("date") ?? "";
  let day: Date;
  try {
    day = jstDateToDb(date);
  } catch {
    return badRequest("日付の形式が正しくありません");
  }
  const ownerId = auth.ctx.ownerId;
  const [notes, previous] = await Promise.all([
    prisma.workDailyNote.findMany({ where: { ownerId, date: day }, select: SELECT }),
    prisma.workDailyNote.findMany({
      where: { ownerId, date: { lt: day, gte: jstDateToDb(handoverFrom(date)) } },
      orderBy: { date: "desc" },
      distinct: ["clientId"],
      select: SELECT,
    }),
  ]);
  return NextResponse.json({ date, notes: notes.map(view), previous: previous.map(view) });
}

// メモを保存する（1クライアント1日1件。本文が空なら消す）
// AI 連携からは、すでに書いた内容を消さないよう後ろに足す（空にして消すこともできない）
// PUT /api/work/daily-notes  body: { clientId, date, body }
export async function PUT(req: NextRequest) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const parsed = parseDailyNote(await req.json().catch(() => null));
  if (!parsed.ok) return badRequest(parsed.error);
  const { clientId, date, body } = parsed.data;
  const ownerId = auth.ctx.ownerId;
  if (!(await ownsClient(ownerId, clientId))) return badRequest("クライアントが見つかりません");

  const key = { ownerId_clientId_date: { ownerId, clientId, date: jstDateToDb(date) } };
  const fromAi = !!currentMcpContext();
  if (body === null) {
    if (fromAi) return badRequest("メモの内容を入力してください");
    await prisma.workDailyNote.deleteMany({ where: { ownerId, clientId, date: jstDateToDb(date) } });
    return NextResponse.json({ clientId, date, body: null });
  }
  if (fromAi) {
    // 追記は1つの SQL で行う（同時に書き込まれても、先に書いた内容が消えないように）。長すぎるときは書かない
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO "WorkDailyNote" ("id", "ownerId", "clientId", "date", "body", "createdAt", "updatedAt")
      VALUES (${randomUUID()}, ${ownerId}, ${clientId}, ${date}::date, ${body}, now(), now())
      ON CONFLICT ("ownerId", "clientId", "date") DO UPDATE
        SET "body" = "WorkDailyNote"."body" || E'\n\n' || EXCLUDED."body", "updatedAt" = now()
        WHERE length("WorkDailyNote"."body") + 2 + length(EXCLUDED."body") <= ${MAX_DAILY_NOTE}
      RETURNING "id"`;
    if (rows.length === 0) return badRequest(`メモが${MAX_DAILY_NOTE}文字を超えます。アプリの画面で整理してください`);
    const saved = await prisma.workDailyNote.findUniqueOrThrow({ where: { id: rows[0].id }, select: SELECT });
    return NextResponse.json(view(saved));
  }
  const saved = await prisma.workDailyNote.upsert({
    where: key,
    create: { ownerId, clientId, date: jstDateToDb(date), body },
    update: { body },
    select: SELECT,
  });
  return NextResponse.json(view(saved));
}
