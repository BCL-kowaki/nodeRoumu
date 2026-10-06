import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canAccessAdminArea } from "@/lib/permissions";
import { addDays, jstDateToDb } from "@/lib/date-jst";

export const dynamic = "force-dynamic";

// 出勤簿の変更履歴（AI 連携からの修正）  GET /api/attendance/changes?employeeId=xxx&month=YYYY-MM
// 代表者・社労士が閲覧できる（出勤簿と同じ）
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canAccessAdminArea(session.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const employeeId = req.nextUrl.searchParams.get("employeeId");
  const month = req.nextUrl.searchParams.get("month");
  if (!employeeId || !month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return NextResponse.json({ error: "従業員と月を指定してください" }, { status: 400 });
  }
  const from = jstDateToDb(`${month}-01`);
  const to = jstDateToDb(addDays(`${month}-28`, 4).slice(0, 7) + "-01");
  const changes = await prisma.attendanceChange.findMany({
    where: { employeeId, date: { gte: from, lt: to } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, date: true, changes: true, source: true, tokenName: true, createdAt: true },
  });
  return NextResponse.json(changes);
}
