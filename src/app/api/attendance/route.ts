import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canWriteAttendanceTime } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// 出勤簿取得（クエリ: employeeId, month）
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get("employeeId");
  const month = searchParams.get("month"); // YYYY-MM

  const where: Record<string, unknown> = {};
  if (employeeId) where.employeeId = employeeId;
  if (month) {
    const start = new Date(month + "-01");
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    where.date = { gte: start, lt: end };
  }

  const records = await prisma.attendance.findMany({
    where,
    orderBy: { date: "asc" },
  });
  return NextResponse.json(records);
}

// 出勤簿のupsert（打刻から自動同期 or 手動入力）
// - body に明示的に null を渡すと DB を null に更新できる（時刻のクリア等）
// - キー自体が body に含まれなければ undefined 扱いで更新対象から外す
// - 打刻時刻（startTime/endTime/breakMinutes）の変更は admin のみ
//   manager はステータス・備考のみ編集可
//   ※ employeeロールの打刻機能（dakoku API）は別経路なので影響しない
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const date = new Date(body.date);

  // 打刻時刻の編集は admin のみ。manager が送ってきても無視して undefined にする
  const allowTimeWrite = canWriteAttendanceTime(session.role);

  // 明示的に null が送られてきた場合は null にする、キーがなければ undefined
  const startTime =
    allowTimeWrite && "startTime" in body
      ? body.startTime === null
        ? null
        : body.startTime
      : undefined;
  const endTime =
    allowTimeWrite && "endTime" in body
      ? body.endTime === null
        ? null
        : body.endTime
      : undefined;
  const breakMinutes =
    allowTimeWrite && "breakMinutes" in body
      ? body.breakMinutes === null || body.breakMinutes === ""
        ? null
        : Number(body.breakMinutes)
      : undefined;
  const status =
    "status" in body ? (body.status === null || body.status === "" ? null : body.status) : undefined;
  const memo = "memo" in body ? (body.memo === null ? null : body.memo) : undefined;

  const record = await prisma.attendance.upsert({
    where: {
      employeeId_date: {
        employeeId: body.employeeId,
        date,
      },
    },
    update: {
      startTime,
      endTime,
      breakMinutes,
      status,
      memo,
    },
    create: {
      employeeId: body.employeeId,
      date,
      startTime: startTime ?? null,
      endTime: endTime ?? null,
      breakMinutes: breakMinutes ?? null,
      status: status ?? null,
      memo: memo ?? null,
    },
  });
  return NextResponse.json(record);
}
