import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canAccessAdminArea } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// 打刻ログ取得（クエリ: employeeId, date）
// 代表者・社労士は全員分、従業員は自分の分のみ（GPS位置情報を含むため）
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const employeeId = canAccessAdminArea(session.role)
    ? searchParams.get("employeeId")
    : session.employeeId;
  const date = searchParams.get("date"); // YYYY-MM-DD

  const where: Record<string, unknown> = {};
  if (employeeId) where.employeeId = employeeId;
  if (date) where.date = new Date(date);

  const records = await prisma.dakoku.findMany({
    where,
    orderBy: { timestamp: "asc" },
  });
  return NextResponse.json(records);
}

// 時刻文字列を分に変換 "HH:MM" → 分
function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// 遅刻・早退判定
function calcStatus(
  inTime: string | null,
  outTime: string | null,
  shiftStart: string | null,
  shiftEnd: string | null
): string {
  if (!inTime) return "normal";
  // 遅刻判定: 出勤打刻がシフト開始より後
  const isLate = shiftStart && inTime ? timeToMin(inTime) > timeToMin(shiftStart) : false;
  // 早退判定: 退勤打刻がシフト終了より前
  const isEarly = shiftEnd && outTime ? timeToMin(outTime) < timeToMin(shiftEnd) : false;

  if (isLate && isEarly) return "late"; // 遅刻優先
  if (isLate) return "late";
  if (isEarly) return "early_leave";
  return "normal";
}

// 打刻記録 + 出勤簿自動同期 + ステータス判定
// 打刻は常にログイン中の本人として記録する（他人の打刻・出勤簿の書き換えを防ぐ）
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const employeeId = session.employeeId;
  const date = new Date(body.date);

  // 打刻ログを追加（GPS含む）
  const dakoku = await prisma.dakoku.create({
    data: {
      employeeId,
      date,
      time: body.time,
      type: body.type,
      latitude: body.latitude ?? null,
      longitude: body.longitude ?? null,
    },
  });

  // 出勤簿を自動同期
  const dayLogs = await prisma.dakoku.findMany({
    where: { employeeId, date },
    orderBy: { timestamp: "asc" },
  });

  const inLog = dayLogs.find((l) => l.type === "in");
  const outLog = [...dayLogs].reverse().find((l) => l.type === "out");

  // 休憩時間の計算
  let breakMinutes = 0;
  let breakStart: string | null = null;
  for (const l of dayLogs) {
    if (l.type === "break_start") breakStart = l.time;
    if (l.type === "break_end" && breakStart) {
      const [h1, m1] = breakStart.split(":").map(Number);
      const [h2, m2] = l.time.split(":").map(Number);
      breakMinutes += (h2 * 60 + m2) - (h1 * 60 + m1);
      breakStart = null;
    }
  }

  // 従業員の固定シフトを取得して遅刻・早退を判定
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { shiftStart: true, shiftEnd: true },
  });

  const status = calcStatus(
    inLog?.time || null,
    outLog?.time || null,
    employee?.shiftStart || null,
    employee?.shiftEnd || null
  );

  await prisma.attendance.upsert({
    where: {
      employeeId_date: { employeeId, date },
    },
    update: {
      startTime: inLog?.time || null,
      endTime: outLog?.time || null,
      breakMinutes: breakMinutes || null,
      status,
      memo: "打刻",
    },
    create: {
      employeeId,
      date,
      startTime: inLog?.time || null,
      endTime: outLog?.time || null,
      breakMinutes: breakMinutes || null,
      status,
      memo: "打刻",
    },
  });

  return NextResponse.json(dakoku, { status: 201 });
}
