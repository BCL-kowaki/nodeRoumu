import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { checkImportCalendar, getConnection, importCalendarStatus } from "@/lib/google-calendar";
import { todayJst } from "@/lib/date-jst";
import { badRequest, notFound, requireWorkspace } from "@/lib/work/auth";
import { parseImportCalendar } from "@/lib/work/gcal";

export const dynamic = "force-dynamic";

const MAX_IMPORT_CALENDARS = 10;
const SELECT = { id: true, calendarId: true, label: true, createdAt: true } as const;

// 予定を取り込むカレンダー（会社のメイン以外）の一覧
// ?check=1 を付けると、それぞれ読めるかと、今日から2週間の予定の件数も返す
export async function GET(req: NextRequest) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const list = await prisma.googleImportCalendar.findMany({ where: { ownerId: auth.ctx.ownerId }, orderBy: { createdAt: "asc" }, select: SELECT });
  if (req.nextUrl.searchParams.get("check") !== "1" || list.length === 0) return NextResponse.json(list);
  const acc = await getConnection(auth.ctx.ownerId);
  if (!acc || acc.status !== "active") return NextResponse.json(list);
  try {
    const status = await importCalendarStatus(auth.ctx.ownerId, list.map((c) => c.calendarId), todayJst());
    return NextResponse.json(list.map((c) => ({ ...c, ...status[c.calendarId] })));
  } catch {
    // 接続そのものの問題（再接続が必要など）は、一覧だけ返す
    return NextResponse.json(list);
  }
}

// 取り込むカレンダーを登録する（実際に読めるかを確かめてから）
// POST /api/work/google/calendars  body: { calendarId, label? }
export async function POST(req: NextRequest) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const parsed = parseImportCalendar(await req.json().catch(() => null));
  if (!parsed.ok) return badRequest(parsed.error);
  const ownerId = auth.ctx.ownerId;
  const acc = await getConnection(ownerId);
  if (!acc || acc.status !== "active") return badRequest("先に Google カレンダーに接続してください");
  if (acc.accountEmail && parsed.data.calendarId.toLowerCase() === acc.accountEmail.toLowerCase()) {
    return badRequest("接続中のアカウント自身のカレンダーは、最初から取り込まれています");
  }
  if ((await prisma.googleImportCalendar.count({ where: { ownerId } })) >= MAX_IMPORT_CALENDARS) {
    return badRequest(`取り込むカレンダーは${MAX_IMPORT_CALENDARS}個までです`);
  }
  const unreadable = await checkImportCalendar(ownerId, parsed.data.calendarId);
  if (unreadable) return badRequest(unreadable);
  try {
    const created = await prisma.googleImportCalendar.create({ data: { ownerId, ...parsed.data }, select: SELECT });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return badRequest("このカレンダーはすでに登録されています");
    throw e;
  }
}

// 取り込むカレンダーの登録を外す（Google 側のカレンダー・予定には何もしない）
// DELETE /api/work/google/calendars?id=xxx
export async function DELETE(req: NextRequest) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const { count } = await prisma.googleImportCalendar.deleteMany({ where: { id, ownerId: auth.ctx.ownerId } });
  if (count === 0) return notFound();
  return NextResponse.json({ ok: true });
}
